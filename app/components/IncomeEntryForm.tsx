"use client";

import { useActionState, useEffect, useState } from "react";
import { upsertIncomeRecord } from "@/lib/actions/income";
import type { ActionResult } from "@/lib/actions/assets";
import type { IncomeRecordView, PersonView } from "@/lib/data";

const FIELD =
  "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

type ExpenseRow = { label: string; amount: string };

export function IncomeEntryForm({
  people,
  month,
  recordByPerson,
}: {
  people: PersonView[];
  month: string;
  recordByPerson: Record<string, IncomeRecordView>;
}) {
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [income, setIncome] = useState("");
  const [tax, setTax] = useState("");
  const [zus, setZus] = useState("");
  const [note, setNote] = useState("");
  const [expenses, setExpenses] = useState<ExpenseRow[]>([
    { label: "Biuro rachunkowe", amount: "" },
  ]);

  function load(pid: string) {
    const r = pid ? recordByPerson[pid] : undefined;
    setIncome(r ? String(r.income) : "");
    setTax(r ? String(r.tax) : "");
    setZus(r ? String(r.zus) : "");
    setNote(r?.note ?? "");
    setExpenses(
      r && r.expenses.length > 0
        ? r.expenses.map((e) => ({ label: e.label, amount: String(e.amount) }))
        : [{ label: "Biuro rachunkowe", amount: "" }]
    );
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => load(personId), [personId]);

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null, fd: FormData) => {
      const labels = fd.getAll("expenseLabel").map(String);
      const amounts = fd.getAll("expenseAmount").map(String);
      const exp = labels
        .map((label, i) => ({ label, amount: amounts[i] ?? "0" }))
        .filter((e) => e.label.trim() !== "" || Number(e.amount) > 0);
      return upsertIncomeRecord({
        personId: fd.get("personId"),
        month: fd.get("month"),
        income: fd.get("income"),
        tax: fd.get("tax"),
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
          <span className="text-xs font-medium text-slate-400">Podatek (PLN)</span>
          <input name="tax" type="number" min="0" step="0.01" inputMode="decimal" value={tax} onChange={(e) => setTax(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Składki ZUS (PLN)</span>
          <input name="zus" type="number" min="0" step="0.01" inputMode="decimal" value={zus} onChange={(e) => setZus(e.target.value)} className={FIELD} />
        </label>
      </div>

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
                min="0"
                step="0.01"
                inputMode="decimal"
                value={row.amount}
                onChange={(e) =>
                  setExpenses((prev) => prev.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))
                }
                placeholder="0,00"
                className={`${FIELD} mt-0 w-32`}
              />
              <button
                type="button"
                onClick={() => setExpenses((prev) => prev.filter((_, j) => j !== i))}
                className="shrink-0 self-center rounded-md border border-white/10 px-2 py-1 text-xs text-slate-400 hover:bg-white/5"
                aria-label="Usuń wydatek"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setExpenses((prev) => [...prev, { label: "", amount: "" }])}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300"
        >
          + dodaj wydatek
        </button>
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
