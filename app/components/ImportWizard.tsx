"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  FIELD_LABELS,
  PRESETS,
  getPreset,
  type FieldKey,
} from "@/lib/import/presets";
import { buildCanonicalRows, summarize } from "@/lib/import/transform";
import { commitImport, type CommitSummary } from "@/lib/actions/import";
import type { AssetSnapshot } from "@/lib/data";

const ALL_FIELDS: FieldKey[] = [
  "date",
  "amount",
  "balance",
  "currency",
  "description",
  "type",
  "quantity",
  "price",
];
const VALUATION_FIELDS: FieldKey[] = ["date", "amount", "balance", "currency", "description"];
const TRANSACTION_FIELDS: FieldKey[] = [
  "date",
  "type",
  "quantity",
  "price",
  "amount",
  "currency",
  "description",
];

type Parsed = {
  headers: string[];
  rows: Record<string, string>[];
  encoding: string;
  delimiter: string;
};

function suggestMap(
  presetId: string,
  headers: string[]
): Partial<Record<FieldKey, string>> {
  const preset = getPreset(presetId);
  const m: Partial<Record<FieldKey, string>> = {};
  for (const f of ALL_FIELDS) {
    const col = preset.columnMap[f];
    if (col && headers.includes(col)) m[f] = col;
  }
  return m;
}

export function ImportWizard({ assets }: { assets: AssetSnapshot[] }) {
  const activeAssets = assets.filter((a) => a.isActive);
  const [step, setStep] = useState<"upload" | "map" | "review" | "done">("upload");

  const [presetId, setPresetId] = useState("generic");
  const [skipRows, setSkipRows] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [filename, setFilename] = useState("");

  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [columnMap, setColumnMap] = useState<Partial<Record<FieldKey, string>>>({});

  const [assetId, setAssetId] = useState(activeAssets[0]?.id ?? "");
  const [duplicatePolicy, setDuplicatePolicy] = useState<"skip" | "overwrite">("skip");
  const [target, setTarget] = useState<"valuations" | "transactions">("valuations");

  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CommitSummary | null>(null);

  const preset = getPreset(presetId);
  const summary = useMemo(
    () => (parsed ? summarize(buildCanonicalRows(parsed.rows, columnMap, preset)) : null),
    [parsed, columnMap, preset]
  );
  const previewRows = useMemo(
    () =>
      parsed
        ? buildCanonicalRows(parsed.rows.slice(0, 8), columnMap, preset)
        : [],
    [parsed, columnMap, preset]
  );

  const fields = target === "transactions" ? TRANSACTION_FIELDS : VALUATION_FIELDS;
  const requiredField = (f: FieldKey) =>
    f === "date" || (target === "transactions" && f === "amount");
  const requiredOk =
    target === "transactions"
      ? !!columnMap.date && !!columnMap.amount
      : !!columnMap.date && (!!columnMap.amount || !!columnMap.balance);
  const canProceedToReview = !!parsed && requiredOk && (summary?.valid ?? 0) > 0;

  async function onParse() {
    if (!file) return;
    setParsing(true);
    setError(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("preset", presetId);
    fd.append("skipRows", String(skipRows));
    try {
      const res = await fetch("/api/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Błąd parsowania");
      setParsed({
        headers: data.headers,
        rows: data.rows,
        encoding: data.encoding,
        delimiter: data.delimiter,
      });
      setFilename(data.filename || file.name);
      setColumnMap(suggestMap(presetId, data.headers));
      setStep("map");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Błąd parsowania");
    } finally {
      setParsing(false);
    }
  }

  function onPresetChange(id: string) {
    setPresetId(id);
    setSkipRows(getPreset(id).skipRows ?? 0);
    if (parsed) setColumnMap(suggestMap(id, parsed.headers));
  }

  function setField(f: FieldKey, val: string) {
    setColumnMap((prev) => {
      const next = { ...prev };
      if (val === "") delete next[f];
      else next[f] = val;
      return next;
    });
  }

  async function onCommit() {
    if (!parsed || !assetId) return;
    setCommitting(true);
    setError(null);
    const res = await commitImport({
      filename,
      presetId,
      columnMap,
      assetId,
      duplicatePolicy,
      target,
      rows: parsed.rows,
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
      {/* pasek kroków */}
      <Steps step={step} />

      {error && (
        <p className="mb-3 rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {step === "upload" && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Źródło (preset)</span>
              <select
                value={presetId}
                onChange={(e) => onPresetChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              >
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-xs text-slate-500">{preset.hint}</span>
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Pomiń wierszy (preamble)</span>
              <input
                type="number"
                min="0"
                value={skipRows}
                onChange={(e) => setSkipRows(Number(e.target.value))}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              />
            </label>
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Plik CSV</span>
              <input
                type="file"
                accept=".csv,.txt"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-emerald-500 file:px-3 file:py-1.5 file:text-slate-950"
              />
            </label>
          </div>
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
        <div className="mt-4 space-y-4">
          <p className="text-xs text-slate-500">
            Wykryto: separator <b>{parsed.delimiter}</b> · kodowanie <b>{parsed.encoding}</b> · {parsed.rows.length} wierszy
          </p>

          <div className="flex flex-wrap gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={target === "valuations"}
                onChange={() => setTarget("valuations")}
              />
              Wyceny (wartość w czasie — saldo / running balance)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={target === "transactions"}
                onChange={() => setTarget("transactions")}
              />
              Transakcje (historia zakupów)
            </label>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => (
              <label key={f} className="block">
                <span className="text-xs font-medium text-slate-400">
                  {FIELD_LABELS[f]}
                  {requiredField(f) && <span className="text-red-400"> *</span>}
                </span>
                <select
                  value={columnMap[f] ?? ""}
                  onChange={(e) => setField(f, e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
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
          </div>

          {summary && (
            <div className="flex flex-wrap gap-4 text-sm">
              <Stat label="Wszystkich" value={summary.total} />
              <Stat label="Poprawnych" value={summary.valid} tone="green" />
              <Stat label="Z błędem" value={summary.withErrors} tone="red" />
              <Stat label="Z ostrzeżeniem" value={summary.withWarnings} tone="amber" />
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/5 text-left text-slate-500">
                  <th className="py-1 pr-2">Data</th>
                  {target === "transactions" ? (
                    <>
                      <th className="py-1 pr-2">Typ</th>
                      <th className="py-1 pr-2">Ilość</th>
                      <th className="py-1 pr-2">Cena</th>
                      <th className="py-1 pr-2">Kwota</th>
                    </>
                  ) : (
                    <>
                      <th className="py-1 pr-2">Kwota</th>
                      <th className="py-1 pr-2">Saldo</th>
                    </>
                  )}
                  <th className="py-1 pr-2">Opis</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 text-slate-300">
                    <td className="py-1 pr-2">{r.date ?? "—"}</td>
                    {target === "transactions" ? (
                      <>
                        <td className="py-1 pr-2">{r.type}</td>
                        <td className="py-1 pr-2">{r.quantity ?? "—"}</td>
                        <td className="py-1 pr-2">{r.price ?? "—"}</td>
                        <td className="py-1 pr-2">{r.amount ?? "—"}</td>
                      </>
                    ) : (
                      <>
                        <td className="py-1 pr-2">{r.amount ?? "—"}</td>
                        <td className="py-1 pr-2">{r.balance ?? "—"}</td>
                      </>
                    )}
                    <td className="py-1 pr-2 max-w-[200px] truncate">{r.description || "—"}</td>
                    <td className="py-1">
                      {r.errors.length > 0 ? (
                        <span className="text-red-400">✕ {r.errors[0]}</span>
                      ) : r.warnings.length > 0 ? (
                        <span className="text-amber-400">⚠</span>
                      ) : (
                        <span className="text-emerald-400">✓</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("upload")}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              Wstecz
            </button>
            <button
              onClick={() => setStep("review")}
              disabled={!canProceedToReview}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
            >
              Dalej
            </button>
          </div>
        </div>
      )}

      {step === "review" && parsed && summary && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-medium text-slate-400">Aktywo docelowe</span>
              <select
                value={assetId}
                onChange={(e) => setAssetId(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
              >
                {activeAssets.length === 0 ? (
                  <option value="">— brak aktywnych aktywów —</option>
                ) : (
                  activeAssets.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            {target === "valuations" ? (
              <div>
                <span className="text-xs font-medium text-slate-400">Duplikaty (data+aktywo już w bazie)</span>
                <div className="mt-1 space-y-1">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={duplicatePolicy === "skip"}
                      onChange={() => setDuplicatePolicy("skip")}
                    />
                    Pomiń
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="radio"
                      checked={duplicatePolicy === "overwrite"}
                      onChange={() => setDuplicatePolicy("overwrite")}
                    />
                    Nadpisz
                  </label>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">
                Tryb transakcji: brak deduplikacji — każdy wiersz dodawany osobno
                (cofnięcie przez historię importów).
              </div>
            )}
          </div>

          <div className="rounded-md bg-white/[0.03] p-3 text-sm text-slate-300">
            {target === "transactions" ? (
              <>
                Zostanie zaimportowanych <b>{summary.valid}</b> transakcji (historia zakupów) do aktywa.
              </>
            ) : (
              <>
                Zostanie zaimportowanych <b>{summary.valid}</b> wycen do aktywa
                ({columnMap.balance ? "tryb saldo (snapshot)" : "tryb running balance"}).
              </>
            )}
            {summary.withWarnings > 0 && (
              <span className="text-amber-400"> {summary.withWarnings} z ostrzeżeniem (data).</span>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep("map")}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              Wstecz
            </button>
            <button
              onClick={onCommit}
              disabled={committing || !assetId}
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
            >
              {committing ? "Importuję…" : "Importuj"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && result && (
        <div className="mt-4 space-y-3">
          <p className="text-emerald-400">✓ Import zakończony.</p>
          <div className="flex flex-wrap gap-4 text-sm">
            <Stat label="Zaimportowano" value={result.imported} tone="green" />
            <Stat label="Pominięto" value={result.skipped} />
            <Stat label="Duplikatów" value={result.duplicates} tone="amber" />
            <Stat label="Z błędem" value={result.invalid} tone="red" />
          </div>
          <div className="flex gap-2">
            <Link
              href="/"
              className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400"
            >
              Zobacz na wykresie
            </Link>
            <button
              onClick={() => {
                setStep("upload");
                setParsed(null);
                setFile(null);
                setResult(null);
                setColumnMap({});
                setTarget("valuations");
              }}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-white/5"
            >
              Importuj kolejny
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: string }) {
  const steps = [
    { id: "upload", label: "1. Plik" },
    { id: "map", label: "2. Mapowanie" },
    { id: "review", label: "3. Przypisanie" },
    { id: "done", label: "4. Gotowe" },
  ];
  return (
    <div className="flex gap-2">
      {steps.map((s) => (
        <span
          key={s.id}
          className={`rounded-full px-3 py-1 text-xs ${
            step === s.id
              ? "bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950"
              : "bg-white/5 text-slate-400"
          }`}
        >
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
  tone = "gray",
}: {
  label: string;
  value: number;
  tone?: "gray" | "green" | "red" | "amber";
}) {
  const toneClass = {
    gray: "text-slate-200",
    green: "text-emerald-400",
    red: "text-red-400",
    amber: "text-amber-400",
  }[tone];
  return (
    <div>
      <div className={`text-lg font-semibold ${toneClass}`}>{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
