"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { commitIncomeImport, type IncomeImportSummary } from "@/lib/actions/income";
import type { PersonView } from "@/lib/data";
import { parseAmount, parseDate } from "@/lib/import/transform";
import { formatPLN } from "@/lib/format";

const FIELD =
  "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";
const FIELD_SM =
  "w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

type Parsed = { headers: string[]; rows: Record<string, string>[]; encoding: string; delimiter: string };
type ExpenseColumn = { column: string; label: string; type: "expense" | "adjustment" };
type Mapping = {
  person: string; // kolumna CSV z nazwą osoby (opcjonalna)
  personManual: string; // fallback: ręcznie wpisana osoba
  month: string;
  income: string;
  vat: string;
  pit: string;
  zus: string;
  expenseColumns: ExpenseColumn[];
};

const CORE_FIELDS: { key: "person" | "month" | "income" | "vat" | "pit" | "zus"; label: string; required?: boolean }[] = [
  { key: "person", label: "Osoba — kolumna" },
  { key: "month", label: "Miesiąc", required: true },
  { key: "income", label: "Przychód" },
  { key: "vat", label: "VAT" },
  { key: "pit", label: "PIT" },
  { key: "zus", label: "ZUS" },
];

function suggest(headers: string[]): Mapping {
  const find = (re: RegExp) => headers.find((h) => re.test(h.toLowerCase())) ?? "";
  const expenseColumns: ExpenseColumn[] = [];
  for (const h of headers) {
    const hl = h.toLowerCase();
    if (/(wyrówn|wyrow|adjust|korek|sett|reconc)/.test(hl)) {
      expenseColumns.push({ column: h, label: h, type: "adjustment" });
    } else if (/(wydat|koszt|expense|księ|ksieg|biuro|innych)/.test(hl)) {
      expenseColumns.push({ column: h, label: h, type: "expense" });
    }
  }
  const vatCol = find(/vat/);
  let pitCol = find(/pit|dochod/);
  // fallback: ogólny „podatek"/„tax" bez kwalifikatora → traktowany jako PIT
  if (!pitCol) pitCol = find(/podat|tax/);
  return {
    person: find(/osob|person|imię|imie|kto/),
    personManual: "",
    month: find(/mies|month|data|okres/),
    income: find(/przych|income|brutto|utarg/),
    vat: vatCol,
    pit: pitCol,
    zus: find(/zus|skład|sklad/),
    expenseColumns,
  };
}

const EMPTY_MAP: Mapping = {
  person: "",
  personManual: "",
  month: "",
  income: "",
  vat: "",
  pit: "",
  zus: "",
  expenseColumns: [],
};

export function IncomeImportWizard({ existingPeople }: { existingPeople: PersonView[] }) {
  const existingNames = new Set(existingPeople.map((p) => p.name.toLowerCase().trim()));

  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping>(EMPTY_MAP);
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [decimalSeparator, setDecimalSeparator] = useState<"," | ".">(",");
  const [createMissing, setCreateMissing] = useState(true);

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IncomeImportSummary | null>(null);

  const resolvePerson = (row: Record<string, string>) => {
    const v = mapping.person ? (row[mapping.person] ?? "").trim() : "";
    return v || mapping.personManual.trim();
  };

  const preview = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.slice(0, 8).map((row) => {
      const person = resolvePerson(row);
      const monthRaw = mapping.month ? (row[mapping.month] ?? "").trim() : "";
      const { iso } = parseDate(monthRaw, dateFormat);
      const num = (k: "income" | "vat" | "pit" | "zus") =>
        mapping[k] ? parseAmount((row[mapping[k]] ?? "").trim(), decimalSeparator, "") : null;
      const lines = mapping.expenseColumns.map((ec) => {
        const raw = (row[ec.column] ?? "").trim();
        const p = raw ? parseAmount(raw, decimalSeparator, "") : null;
        const amount = p == null ? null : ec.type === "expense" ? Math.abs(p) : p;
        return { ec, amount };
      });
      // suma wydatków wg typu: wyrównanie ma znak odwrócony
      const totalExpenses = lines.reduce((s, l) => {
        if (l.amount == null) return s;
        return s + (l.ec.type === "adjustment" ? -l.amount : l.amount);
      }, 0);
      return {
        person,
        month: iso ? iso.slice(0, 7) : "—",
        income: num("income"),
        vat: num("vat"),
        pit: num("pit"),
        zus: num("zus"),
        lines,
        totalExpenses,
        ok: !!iso && !!person,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, mapping, dateFormat, decimalSeparator]);

  const distinctPeople = useMemo(() => {
    if (!parsed) return [];
    const set = new Set<string>();
    for (const r of parsed.rows) {
      const name = resolvePerson(r);
      if (name) set.add(name);
    }
    return [...set];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, mapping.person, mapping.personManual]);

  const canCommitFinal = !!parsed && !!mapping.month && (!!mapping.person || mapping.personManual.trim().length > 0);

  function addExpenseColumn() {
    setMapping((m) => ({
      ...m,
      expenseColumns: [...m.expenseColumns, { column: "", label: "", type: "expense" }],
    }));
  }
  function setEcColumn(i: number, column: string) {
    setMapping((m) => ({
      ...m,
      expenseColumns: m.expenseColumns.map((e, j) => {
        if (j !== i) return e;
        // auto-uzupełnij etykietę, gdy pusta lub niezminiana (= stara kolumna)
        const label = e.label.trim() === "" || e.label === e.column ? column : e.label;
        return { ...e, column, label };
      }),
    }));
  }
  function setEcLabel(i: number, label: string) {
    setMapping((m) => ({
      ...m,
      expenseColumns: m.expenseColumns.map((e, j) => (j === i ? { ...e, label } : e)),
    }));
  }
  function setEcType(i: number, type: "expense" | "adjustment") {
    setMapping((m) => ({
      ...m,
      expenseColumns: m.expenseColumns.map((e, j) => (j === i ? { ...e, type } : e)),
    }));
  }
  function removeEc(i: number) {
    setMapping((m) => ({ ...m, expenseColumns: m.expenseColumns.filter((_, j) => j !== i) }));
  }

  async function onParse() {
    if (!file) return;
    setParsing(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("preset", "generic");
    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd parsowania");
      setParsed({ headers: data.headers, rows: data.rows, encoding: data.encoding, delimiter: data.delimiter });
      setMapping(suggest(data.headers));
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd parsowania");
    } finally {
      setParsing(false);
    }
  }

  async function onCommit() {
    if (!parsed || !canCommitFinal) return;
    setCommitting(true);
    setError(null);
    const res = await commitIncomeImport({
      rows: parsed.rows,
      mapping: {
        person: mapping.person,
        personManual: mapping.personManual,
        month: mapping.month,
        income: mapping.income,
        vat: mapping.vat,
        pit: mapping.pit,
        zus: mapping.zus,
        expenseColumns: mapping.expenseColumns.filter((e) => !!e.column),
      },
      dateFormat,
      decimalSeparator,
      createMissingPeople: createMissing,
    });
    setCommitting(false);
    if (res.ok) {
      setResult(res.data);
      setStep("done");
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-lg shadow-black/20 backdrop-blur-md">
      <div className="mb-3 flex gap-2">
        {["1. Plik", "2. Mapowanie", "3. Gotowe"].map((s, i) => (
          <span key={s} className={`rounded-full px-3 py-1 text-xs ${step === ["upload", "map", "done"][i] ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950" : "bg-white/5 text-slate-400"}`}>
            {s}
          </span>
        ))}
      </div>

      {error && <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}

      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            CSV z kolumnami: osoba (opcjonalna — można wpisać ręcznie), miesiąc, przychód, VAT, PIT, ZUS oraz dowolna liczba kolumn wydatków i wyrównań (±). Osoby dopasowane po nazwie, brakujące utworzone.
          </p>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:font-semibold file:text-slate-950"
          />
          <button
            onClick={onParse}
            disabled={!file || parsing}
            className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
          >
            {parsing ? "Analizuję…" : "Przeanalizuj plik"}
          </button>
        </div>
      )}

      {step === "map" && parsed && (
        <div className="space-y-4">
          <p className="text-xs text-slate-500">
            Wykryto: separator <b>{parsed.delimiter}</b> · kodowanie <b>{parsed.encoding}</b> · {parsed.rows.length} wierszy
          </p>

          {/* Podstawowe pola */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {CORE_FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs font-medium text-slate-400">
                  {f.label}
                  {f.required && <span className="text-red-400"> *</span>}
                </span>
                <select
                  value={mapping[f.key]}
                  onChange={(e) => setMapping((m) => ({ ...m, [f.key]: e.target.value }))}
                  className={FIELD}
                >
                  <option value="">— brak —</option>
                  {parsed.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}

            {/* Osoba — ręczny fallback */}
            <label className="block">
              <span className="text-xs font-medium text-slate-400">
                Osoba — ręcznie <span className="text-slate-600">(gdy brak w pliku)</span>
              </span>
              <input
                value={mapping.personManual}
                onChange={(e) => setMapping((m) => ({ ...m, personManual: e.target.value }))}
                placeholder="np. Jan Kowalski"
                className={FIELD}
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-slate-400">Format daty</span>
              <select value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} className={FIELD}>
                <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                <option value="DD.MM.YYYY">DD.MM.YYYY</option>
                <option value="MM.YYYY">MM.YYYY (miesiąc)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Separator dziesiętny</span>
              <select value={decimalSeparator} onChange={(e) => setDecimalSeparator(e.target.value as "," | ".")} className={FIELD}>
                <option value=",">, (przecinek)</option>
                <option value=".">. (kropka)</option>
              </select>
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={createMissing} onChange={(e) => setCreateMissing(e.target.checked)} />
              Twórz brakujące osoby
            </label>
          </div>

          {/* Kolumny wydatków / wyrównań */}
          <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">
                Inne wydatki / wyrównania <span className="text-slate-600">(kolumny)</span>
              </span>
              <button onClick={addExpenseColumn} className="text-xs text-emerald-400 hover:text-emerald-300">
                + dodaj kolumnę
              </button>
            </div>
            {mapping.expenseColumns.length === 0 ? (
              <p className="text-xs text-slate-500">
                Brak kolumn. Dodaj, aby importować pozycje „innych wydatków" (wartość dodatnia) lub „wyrównania" (wartość ze znakiem ± — korekta netto).
              </p>
            ) : (
              <div className="space-y-2">
                {mapping.expenseColumns.map((ec, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={ec.column}
                      onChange={(e) => setEcColumn(i, e.target.value)}
                      className={`${FIELD_SM} mt-0 max-w-[180px]`}
                    >
                      <option value="">— kolumna —</option>
                      {parsed.headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    <input
                      value={ec.label}
                      onChange={(e) => setEcLabel(i, e.target.value)}
                      placeholder="etykieta"
                      className={`${FIELD_SM} mt-0 max-w-[160px]`}
                    />
                    <select
                      value={ec.type}
                      onChange={(e) => setEcType(i, e.target.value as "expense" | "adjustment")}
                      className={`${FIELD_SM} mt-0 max-w-[150px]`}
                    >
                      <option value="expense">Wydatek (+)</option>
                      <option value="adjustment">Wyrównanie (±)</option>
                    </select>
                    <button
                      type="button"
                      onClick={() => removeEc(i)}
                      className="shrink-0 self-center rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
                      aria-label="Usuń kolumnę"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {distinctPeople.length > 0 && (
            <div className="rounded-md bg-white/[0.03] p-3 text-xs">
              <span className="text-slate-400">Osoby ({distinctPeople.length}): </span>
              {distinctPeople.map((n) => (
                <span key={n} className={`mr-2 ${existingNames.has(n.toLowerCase()) ? "text-emerald-400" : "text-amber-400"}`}>
                  {n}{existingNames.has(n.toLowerCase()) ? "" : " (nowa)"}
                </span>
              ))}
            </div>
          )}

          {/* Podgląd */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="py-1 pr-2">Osoba</th>
                  <th className="py-1 pr-2">Miesiąc</th>
                  <th className="py-1 pr-2">Przychód</th>
                  <th className="py-1 pr-2">VAT</th>
                  <th className="py-1 pr-2">PIT</th>
                  <th className="py-1 pr-2">ZUS</th>
                  {mapping.expenseColumns.map((ec, i) => (
                    <th key={i} className="py-1 pr-2 whitespace-nowrap">
                      {ec.label || ec.column || "—"}
                      {ec.type === "adjustment" && <span className="text-amber-500"> ±</span>}
                    </th>
                  ))}
                  {mapping.expenseColumns.length > 0 && <th className="py-1 pr-2">Razem wydatki</th>}
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1 pr-2 text-slate-300">{r.person || "—"}</td>
                    <td className={`py-1 pr-2 ${r.month === "—" ? "text-red-400" : "text-slate-300"}`}>{r.month}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.income == null ? "—" : formatPLN(r.income)}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.vat == null ? "—" : formatPLN(r.vat)}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.pit == null ? "—" : formatPLN(r.pit)}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.zus == null ? "—" : formatPLN(r.zus)}</td>
                    {r.lines.map((l, j) => (
                      <td
                        key={j}
                        className={`py-1 pr-2 tabular-nums ${
                          l.amount == null ? "text-slate-600" : l.amount < 0 ? "text-amber-400" : "text-slate-300"
                        }`}
                      >
                        {l.amount == null ? "—" : formatPLN(l.amount)}
                      </td>
                    ))}
                    {mapping.expenseColumns.length > 0 && (
                      <td className={`py-1 pr-2 tabular-nums font-medium ${r.totalExpenses < 0 ? "text-amber-400" : "text-slate-300"}`}>
                        {formatPLN(r.totalExpenses)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setStep("upload")} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5">
              Wstecz
            </button>
            <button
              onClick={onCommit}
              disabled={!canCommitFinal || committing}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
            >
              {committing ? "Importuję…" : "Importuj"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="space-y-3">
          <p className="text-emerald-400">✓ Import zakończony.</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Stat label="Zaimportowano" value={result.imported} tone="green" />
            <Stat label="Pominięto" value={result.skipped} />
            <Stat label="Nowe osoby" value={result.peopleCreated} tone="amber" />
          </div>
          {result.createdNames.length > 0 && (
            <p className="text-xs text-slate-500">Utworzone osoby: {result.createdNames.join(", ")}</p>
          )}
          <div className="flex gap-2">
            <Link href="/income" className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400">
              Zobacz w Dochodzie
            </Link>
            <button
              onClick={() => { setStep("upload"); setParsed(null); setFile(null); setResult(null); setMapping(EMPTY_MAP); }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Importuj kolejny
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "gray" }: { label: string; value: number; tone?: "gray" | "green" | "amber" }) {
  const c = tone === "green" ? "text-emerald-400" : tone === "amber" ? "text-amber-400" : "text-slate-200";
  return (
    <div>
      <div className={`text-lg font-semibold ${c}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
