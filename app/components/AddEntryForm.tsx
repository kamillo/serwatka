"use client";

import { useActionState } from "react";
import { addValuation } from "@/lib/actions/valuations";
import type { ActionResult } from "@/lib/actions/assets";
import type { AssetSnapshot } from "@/lib/data";
import { todayISO } from "@/lib/format";

export function AddEntryForm({ assets }: { assets: AssetSnapshot[] }) {
  const activeAssets = assets.filter((a) => a.isActive);

  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ id: string }> | null, fd: FormData) => {
      return addValuation({
        assetId: fd.get("assetId"),
        value: fd.get("value"),
        currency: fd.get("currency"),
        valuationDate: fd.get("valuationDate"),
        note: fd.get("note"),
      });
    },
    null
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Aktywo</span>
          <select
            name="assetId"
            required
            defaultValue={activeAssets[0]?.id ?? ""}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          >
            {activeAssets.length === 0 ? (
              <option value="">— najpierw dodaj aktywo —</option>
            ) : (
              activeAssets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))
            )}
          </select>
        </label>
        <input type="hidden" name="currency" value="PLN" />
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Data</span>
          <input
            type="date"
            name="valuationDate"
            required
            defaultValue={todayISO()}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-gray-500">Wartość (PLN)</span>
          <input
            type="number"
            name="value"
            required
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-gray-500">Notatka (opcjonalnie)</span>
          <input
            type="text"
            name="note"
            maxLength={500}
            className="mt-1 w-full rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </label>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-600">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-600">✓ Wycena zapisana.</p>
      )}

      <button
        type="submit"
        disabled={pending || activeAssets.length === 0}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Dodaj wycenę"}
      </button>
    </form>
  );
}
