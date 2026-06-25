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
        <span className="text-xs font-medium text-gray-500">Miesiąc</span>
        <input
          type="month"
          name="month"
          required
          defaultValue={currentMonth()}
          className="mt-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <label className="block">
        <span className="text-xs font-medium text-gray-500">CPI m/m (%)</span>
        <input
          type="number"
          name="ratePct"
          required
          step="0.1"
          inputMode="decimal"
          placeholder="np. 0.2"
          className="mt-1 w-28 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {pending ? "Zapisywanie…" : "Ustaw / nadpisz"}
      </button>
      {state && !state.ok && <span className="text-sm text-red-600">{state.error}</span>}
      {state?.ok && <span className="text-sm text-emerald-600">✓ Zapisano ({state.data.month}).</span>}
    </form>
  );
}
