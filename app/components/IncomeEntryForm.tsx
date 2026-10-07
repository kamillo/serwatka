"use client";

import { useActionState, useEffect, useState } from "react";
import { upsertIncomeRecord } from "@/lib/actions/income";
import type { ActionResult } from "@/lib/actions/assets";
import type { IncomeRecordView, PersonView } from "@/lib/data";
import { formatMonthPL } from "@/lib/format";

const FIELD =
  "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

type ExpenseRow = { label: string; amount: string; type: "expense" | "adjustment" };

export function IncomeEntryForm({
  people,
  month,
  recordByPerson,
  prevRecordByPerson = {},
}: {
  people: PersonView[];
  month: string;
  recordByPerson: Record<string, IncomeRecordView>;
  /** Najnowszy wcześniejszy wpis per osoba — szablon, gdy w tym miesiącu brak wpisu. */
  prevRecordByPerson?: Record<string, IncomeRecordView>;
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [income, setIncome] = useState("");
  const [vat, setVat] = useState("");
  const [pit, setPit] = useState("");
  const [zus, setZus] = useState("");
  const [note, setNote] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([
    { label: "Biuro rachunkowe", amount: "", type: "expense" },
  ]);
  const [prefilledFrom, setPrefilledFrom] = useState<string | null>(null);
  function load(pid: string) {
    const own = pid ? recordByPerson[pid] : undefined;
    const prev = !own && pid ? prevRecordByPerson[pid] : undefined;
    const r = own ?? prev;
    setPrefilledFrom(prev ? prev.month : null);
    setIncome(r ? String(r.income) : "");
    setVat(r ? String(r.vat) : "");
    setPit(r ? String(r.pit) : "");
    setZus(r ? String(r.zus) : "");
    setNote(own?.note ?? "");
    setExpenses(
      r && r.expenses.length > 0
        ? r.expenses.map((e) => ({
            label: e.label,
            amount: String(e.amount),
            type: (e.type === "adjustment" ? "adjustment" : "expense") as "expense" | "adjustment",
          }))
        : [{ label: "Biuro rachunkowe", amount: "", type: "expense" }]
    );
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(personId), [personId]);

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null, fd: FormData) => {
      const labels = fd.getAll("expenseLabel").map(String);
      const amounts = fd.getAll("expenseAmount").map(String);
      const types = fd.getAll("expenseType").map(String);
      const exp = labels
        .map((label, i) => ({
          label,
          amount: amounts[i] ?? "0",
          type: (types[i] === "adjustment" ? "adjustment" : "expense") as "expense" | "adjustment",
        }))
        .filter((e) => e.label.trim() !== "" || Number(e.amount) !== 0);
      return upsertIncomeRecord({
        personId: fd.get("personId"),
        month: fd.get("month"),
        income: fd.get("income"),
        vat: fd.get("vat"),
        pit: fd.get("pit"),
        zus: fd.get("zus"),
        note: fd.get("note"),
        expenses: exp,
      });
    },
    null
  );

  if (people.length === 0) {
    return <p className="text-sm text-slate-500">Najpierw dodaj osobę poniżej.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="month" value={month} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Osoba</span>
          <select
            name="personId"
            value={personId}
            onChange={(e) => setPersonId(e.target.value)}
            className={FIELD}
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Przychód (PLN)</span>
          <input name="income" type="number" min="0" step="0.01" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">VAT (PLN)</span>
          <input name="vat" type="number" min="0" step="0.01" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">PIT (PLN)</span>
          <input name="pit" type="number" min="0" step="0.01" inputMode="decimal" value={pit} onChange={(e) => setPit(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Składki ZUS (PLN)</span>
          <input name="zus" type="number" min="0" step="0.01" inputMode="decimal" value={zus} onChange={(e) => setZus(e.target.value)} className={FIELD} />
        </label>
      </div>

      {prefilledFrom && !state?.ok && (
        <p className="text-xs text-amber-300/80">
          Brak wpisu w tym miesiącu — pola uzupełnione na podstawie: {formatMonthPL(prefilledFrom)}. Sprawdź kwoty przed zapisem.
        </p>
      )}

      <div>
        <span className="text-xs font-medium text-slate-400">Inne wydatki</span>
        <div className="mt-1 space-y-2">
          {expenses.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="expenseLabel"
                value={row.label}
                onChange={(e) =>
                  setExpenses((prev) => prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))
                }
                placeholder="np. Biuro rachunkowe"
                className={`${FIELD} mt-0`}
              />
              <input
                name="expenseAmount"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={row.amount}
                onChange={(e) =>
                  setExpenses((prev) => prev.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))
                }
                placeholder="0,00"
                className={`${FIELD} mt-0 w-32`}
              />
              <select
                name="expenseType"
                value={row.type}
                onChange={(e) =>
                  setExpenses((prev) =>
                    prev.map((r, j) => (j === i ? { ...r, type: e.target.value as "expense" | "adjustment" } : r))
                  )
                }
                title={row.type === "adjustment" ? "Wyrównanie: znak odwrócony (− zwiększa wydatki, + zmniejsza)" : "Zwykły wydatek"}
                className={`${FIELD} mt-0 w-28`}
              >
                <option value="expense">Wydatek</option>
                <option value="adjustment">Wyrównanie</option>
              </select>
              <button
                type="button"
                onClick={() => setExpenses((prev) => prev.filter((_, j) => j !== i))}
                className="shrink-0 self-center rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
                aria-label="Usuń linię"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpenses((prev) => [...prev, { label: "", amount: "", type: "expense" }])}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
        >
          + dodaj wydatek
        </button>
        <p className="mt-1 text-[11px] text-slate-600">
          Wyrównanie: ujemna wartość zwiększa wydatki, dodatnia zmniejsza (korekta).
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-400">Notatka (opcjonalnie)</span>
        <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} maxLength={500} />
      </label>

      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">✓ Wpis zapisany.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Zapisz wpis"}
      </button>
    </form>
  );
}
