"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { commitIncomeImport, type IncomeImportSummary } from "@/lib/actions/income";
import type { PersonView } from "@/lib/data";
import { parseAmount, parseDate } from "@/lib/import/transform";
import { formatPLN } from "@/lib/format";

const FIELD =
  "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

type Parsed = { headers: string[]; rows: Record<string, string>[]; encoding: string; delimiter: string };
type Mapping = { person: string; month: string; income: string; tax: string; zus: string; expenses: string };

const FIELDS: { key: keyof Mapping; label: string; required?: boolean }[] = [
  { key: "person", label: "Osoba (nazwa)", required: true },
  { key: "month", label: "Miesiąc", required: true },
  { key: "income", label: "Przychód" },
  { key: "tax", label: "Podatek" },
  { key: "zus", label: "ZUS" },
  { key: "expenses", label: "Inne wydatki (łącznie)" },
];

function suggest(headers: string[]): Mapping {
  const find = (re: RegExp) => headers.find((h) => re.test(h.toLowerCase())) ?? "";
  return {
    person: find(/osob|person|imię|imie|kto/),
    month: find(/mies|month|data|okres/),
    income: find(/przych|income|brutto|utarg/),
    tax: find(/podat|tax|vat|pit/),
    zus: find(/zus|skład|sklad/),
    expenses: find(/wydat|koszt|expense|ksieg|biuro/),
  };
}

export function IncomeImportWizard({ existingPeople }: { existingPeople: PersonView[] }) {
  const existingNames = new Set(existingPeople.map((p) => p.name.toLowerCase().trim()));

  const [step, setStep] = useState<"upload" | "map" | "done">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [mapping, setMapping] = useState<Mapping>({ person: "", month: "", income: "", tax: "", zus: "", expenses: "" });
  const [dateFormat, setDateFormat] = useState("YYYY-MM-DD");
  const [decimalSeparator, setDecimalSeparator] = useState<"," | ".">(",");
  const [createMissing, setCreateMissing] = useState(true);

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IncomeImportSummary | null>(null);

  const preview = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.slice(0, 8).map((row) => {
      const g = (k: keyof Mapping) => (mapping[k] ? (row[mapping[k]] ?? "").trim() : "");
      const { iso } = parseDate(g("month"), dateFormat);
      return {
        person: g("person"),
        month: iso ? iso.slice(0, 7) : "—",
        income: mapping.income ? parseAmount(g("income"), decimalSeparator, "") : null,
        tax: mapping.tax ? parseAmount(g("tax"), decimalSeparator, "") : null,
        zus: mapping.zus ? parseAmount(g("zus"), decimalSeparator, "") : null,
        expenses: mapping.expenses ? parseAmount(g("expenses"), decimalSeparator, "") : null,
        ok: !!iso && !!g("person"),
      };
    });
  }, [parsed, mapping, dateFormat, decimalSeparator]);

  const distinctPeople = useMemo(() => {
    if (!parsed || !mapping.person) return [];
    const set = new Set<string>();
    for (const r of parsed.rows) {
      const v = (r[mapping.person] ?? "").trim();
      if (v) set.add(v);
    }
    return [...set];
  }, [parsed, mapping.person]);

  const canCommit = !!parsed && !!mapping.person && !!mapping.month;

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
    if (!parsed || !canCommit) return;
    setCommitting(true);
    setError(null);
    const res = await commitIncomeImport({
      rows: parsed.rows,
      mapping,
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
            CSV z kolumnami: osoba, miesiąc, przychód, podatek, ZUS, inne wydatki. Osoby dopasowane po nazwie (brakujące utworzone).
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
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FIELDS.map((f) => (
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

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="py-1 pr-2">Osoba</th>
                  <th className="py-1 pr-2">Miesiąc</th>
                  <th className="py-1 pr-2">Przychód</th>
                  <th className="py-1 pr-2">Podatek</th>
                  <th className="py-1 pr-2">ZUS</th>
                  <th className="py-1 pr-2">Wydatki</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((r, i) => (
                  <tr key={i} className="border-b border-white/5">
                    <td className="py-1 pr-2 text-slate-300">{r.person || "—"}</td>
                    <td className={`py-1 pr-2 ${r.month === "—" ? "text-red-400" : "text-slate-300"}`}>{r.month}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.income == null ? "—" : formatPLN(r.income)}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.tax == null ? "—" : formatPLN(r.tax)}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.zus == null ? "—" : formatPLN(r.zus)}</td>
                    <td className="py-1 pr-2 text-slate-300">{r.expenses == null ? "—" : formatPLN(r.expenses)}</td>
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
              disabled={!canCommit || committing}
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
              onClick={() => { setStep("upload"); setParsed(null); setFile(null); setResult(null); }}
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
