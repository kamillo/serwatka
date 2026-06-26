"use client";

import { useActionState } from "react";
import { addTransaction } from "@/lib/actions/transactions";
import type { ActionResult } from "@/lib/actions/assets";
import { todayISO } from "@/lib/format";

const TYPES = [
  { value: "BUY", label: "Zakup (BUY)" },
  { value: "SELL", label: "Sprzedaż (SELL)" },
  { value: "DIVIDEND", label: "Dywidenda" },
  { value: "INTEREST", label: "Odsetki" },
  { value: "FEE", label: "Opłata/Prowizja" },
];

export function AddTransactionForm({ assetId }: { assetId: string }) {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null, fd: FormData) => {
      return addTransaction({
        assetId,
        type: fd.get("type"),
        date: fd.get("date"),
        quantity: fd.get("quantity") || undefined,
        price: fd.get("price") || undefined,
        amount: fd.get("amount"),
        note: fd.get("note"),
      });
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Typ</span>
          <select
            name="type"
            defaultValue="BUY"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Data</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={todayISO()}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Kwota (PLN) *</span>
          <input
            type="number"
            name="amount"
            required
            min="0"
            step="0.01"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Ilość</span>
          <input
            type="number"
            name="quantity"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Cena jedn.</span>
          <input
            type="number"
            name="price"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Notatka</span>
          <input
            type="text"
            name="note"
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
      </div>

      {state && !state.ok && <p className="text-sm text-red-400">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-400">✓ Transakcja dodana.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Dodawanie…" : "Dodaj transakcję"}
      </button>
    </form>
  );
}
