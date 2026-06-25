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
          <span className="text-xs font-medium text-gray-500">Typ</span>
          <select
            name="type"
            defaultValue="BUY"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Data</span>
          <input
            type="date"
            name="date"
            required
            defaultValue={todayISO()}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Kwota (PLN) *</span>
          <input
            type="number"
            name="amount"
            required
            min="0"
            step="0.01"
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Ilość</span>
          <input
            type="number"
            name="quantity"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Cena jedn.</span>
          <input
            type="number"
            name="price"
            min="0"
            step="0.0001"
            inputMode="decimal"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Notatka</span>
          <input
            type="text"
            name="note"
            maxLength={500}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">✓ Transakcja dodana.</p>}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Dodawanie…" : "Dodaj transakcję"}
      </button>
    </form>
  );
}
