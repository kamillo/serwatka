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
          <span className="text-xs font-medium text-slate-400">Aktywo</span>
          <select
            name="assetId"
            required
            defaultValue={activeAssets[0]?.id ?? ""}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
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
          <span className="text-xs font-medium text-slate-400">Data</span>
          <input
            type="date"
            name="valuationDate"
            required
            defaultValue={todayISO()}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-slate-400">Wartość (PLN)</span>
          <input
            type="number"
            name="value"
            required
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="0,00"
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-medium text-slate-400">Notatka (opcjonalnie)</span>
          <input
            type="text"
            name="note"
            maxLength={500}
            className="mt-1 w-full rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
          />
        </label>
      </div>

      {state && !state.ok && (
        <p className="text-sm text-red-400">{state.error}</p>
      )}
      {state?.ok && (
        <p className="text-sm text-emerald-400">✓ Wycena zapisana.</p>
      )}

      <button
        type="submit"
        disabled={pending || activeAssets.length === 0}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Dodaj wycenę"}
      </button>
    </form>
  );
}
