"use client";

import { useState } from "react";
import { syncInflationEurostat } from "@/lib/actions/inflation";

export function SyncEurostatButton() {
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    if (
      !confirm(
        "Pobrać inflację z Eurostat (HICP, Polska)? Zastąpi miesięczne dane od 2015 prawdziwym m/m."
      )
    )
      return;
    setPending(true);
    setMsg(null);
    const res = await syncInflationEurostat();
    setMsg(
      res.ok
        ? `✓ Zsynchronizowano: ${res.data.months} miesięcy (Eurostat HICP).`
        : `✗ ${res.error}`
    );
    setPending(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        onClick={run}
        disabled={pending}
        className="rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-500 px-3 py-1.5 text-sm font-semibold text-slate-950 hover:from-emerald-400 hover:to-cyan-400 disabled:opacity-50"
      >
        {pending ? "Synchronizuję…" : "⟳ Sync z Eurostat (HICP)"}
      </button>
      {msg && <span className="text-xs text-slate-400">{msg}</span>}
    </div>
  );
}
