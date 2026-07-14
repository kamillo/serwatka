"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteIncomeRecord, upsertIncomeRecord } from "@/lib/actions/income";
import type { ActionResult } from "@/lib/actions/assets";
import type { IncomeRecordView } from "@/lib/data";

const FIELD =
  "mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30";

type ExpenseRow = { label: string; amount: string; type: "expense" | "adjustment" };

/** Kompaktowy edytor pojedynczego wpisu (osoba × miesiąc) — do widoku szczegółowego. */
export function IncomeEntryEditor({
  personId,
  month,
  record,
  onDone,
}: {
  personId: string;
  month: string;
  record: IncomeRecordView | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [income, setIncome] = useState(record ? String(record.income) : "");
  const [vat, setVat] = useState(record ? String(record.vat) : "");
  const [pit, setPit] = useState(record ? String(record.pit) : "");
  const [zus, setZus] = useState(record ? String(record.zus) : "");
  const [note, setNote] = useState(record?.note ?? "");
  const [expenses, setExpenses] = useState<ExpenseRow[]>(
    record && record.expenses.length > 0
      ? record.expenses.map((e) => ({
          label: e.label,
          amount: String(e.amount),
          type: (e.type === "adjustment" ? "adjustment" : "expense") as "expense" | "adjustment",
        }))
      : [{ label: "Biuro rachunkowe", amount: "", type: "expense" }]
  );
  const [deleting, setDeleting] = useState(false);

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

  async function onDelete() {
    if (!record) return;
    if (!confirm("Usunąć ten wpis?")) return;
    setDeleting(true);
    await deleteIncomeRecord(record.id);
    router.refresh();
    onDone?.();
  }

  return (
    <form action={formAction} className="space-y-3 rounded-lg border border-white/10 bg-black/20 p-3">
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="month" value={month} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Przychód</span>
          <input name="income" type="number" min="0" step="0.01" inputMode="decimal" value={income} onChange={(e) => setIncome(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">VAT</span>
          <input name="vat" type="number" min="0" step="0.01" inputMode="decimal" value={vat} onChange={(e) => setVat(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">PIT</span>
          <input name="pit" type="number" min="0" step="0.01" inputMode="decimal" value={pit} onChange={(e) => setPit(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">ZUS</span>
          <input name="zus" type="number" min="0" step="0.01" inputMode="decimal" value={zus} onChange={(e) => setZus(e.target.value)} className={FIELD} />
        </label>
      </div>

      <div>
        <span className="text-xs font-medium text-slate-400">Inne wydatki / wyrównania</span>
        <div className="mt-1 space-y-2">
          {expenses.map((row, i) => (
            <div key={i} className="flex gap-2">
              <input
                name="expenseLabel"
                value={row.label}
                onChange={(e) => setExpenses((prev) => prev.map((r, j) => (j === i ? { ...r, label: e.target.value } : r)))}
                placeholder="np. Biuro rachunkowe"
                className={`${FIELD} mt-0`}
              />
              <input
                name="expenseAmount"
                type="number"
                step="0.01"
                inputMode="decimal"
                value={row.amount}
                onChange={(e) => setExpenses((prev) => prev.map((r, j) => (j === i ? { ...r, amount: e.target.value } : r)))}
                placeholder="0,00"
                className={`${FIELD} mt-0 w-28`}
              />
              <select
                name="expenseType"
                value={row.type}
                onChange={(e) => setExpenses((prev) => prev.map((r, j) => (j === i ? { ...r, type: e.target.value as "expense" | "adjustment" } : r)))}
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
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-400">Notatka</span>
        <input name="note" value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} maxLength={500} />
      </label>

      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">✓ Zapisano.</p>}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
        >
          {pending ? "Zapisywanie…" : "Zapisz"}
        </button>
        {record && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
          >
            {deleting ? "Usuwanie…" : "Usuń wpis"}
          </button>
        )}
      </div>
    </form>
  );
}
