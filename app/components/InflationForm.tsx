"use client";

import { useActionState } from "react";
import { setInflationRate } from "@/lib/actions/inflation";
import type { ActionResult } from "@/lib/actions/assets";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function InflationForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: ActionResult<{ month: string }> | null, fd: FormData) => {
      const month = fd.get("month") as string;
      const ratePct = Number(fd.get("ratePct"));
      return setInflationRate({ month, rate: ratePct / 100 }); // % → ułamek
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="text-xs font-medium text-slate-400">Miesiąc</span>
        <input
          type="month"
          name="month"
          required
          defaultValue={currentMonth()}
          className="mt-1 rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-slate-400">CPI m/m (%)</span>
        <input
          type="number"
          name="ratePct"
          required
          step="0.1"
          inputMode="decimal"
          placeholder="np. 0.2"
          className="mt-1 w-28 rounded-lg border border-white/10 bg-white/[0.03] h-9 px-2 text-sm text-slate-100 placeholder-slate-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Ustaw / nadpisz"}
      </button>
      {state && !state.ok && <span className="text-sm text-red-400">{state.error}</span>}
      {state?.ok && <span className="text-sm text-emerald-400">✓ Zapisano ({state.data.month}).</span>}
    </form>
  );
}
