"use client";

import { useTransition } from "react";
import Link from "next/link";
import { deleteAsset, toggleAssetActive } from "@/lib/actions/assets";
import type { AssetSnapshot } from "@/lib/data";
import { formatDate, formatPercent, formatPLN } from "@/lib/format";

export function AssetTable({ assets }: { assets: AssetSnapshot[] }) {
  const [pending, startTransition] = useTransition();

  if (assets.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Brak aktywów. Dodaj pierwsze poniżej.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5 text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-3 font-medium">Aktywo</th>
            <th className="py-2 pr-3 font-medium">Kategoria</th>
            <th className="py-2 pr-3 text-right font-medium">Wartość</th>
            <th className="py-2 pr-3 text-right font-medium">Δ</th>
            <th className="py-2 pr-3 font-medium">Ostatnia wycena</th>
            <th className="py-2 text-right font-medium">Akcje</th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => {
            const delta =
              a.prevValue != null && a.prevValue > 0
                ? ((a.latestValue - a.prevValue) / a.prevValue) * 100
                : null;
            const deltaClass =
              delta == null
                ? "text-slate-400"
                : delta >= 0
                  ? "text-emerald-400"
                  : "text-red-400";
            return (
              <tr
                key={a.id}
                className={`border-b border-white/5 ${
                  a.isActive ? "" : "opacity-50"
                }`}
              >
                <td className="py-2 pr-3 font-medium text-slate-300">
                  <Link href={`/assets/${a.id}`} className="text-slate-100 hover:underline">
                    {a.name}
                  </Link>
                </td>
                <td className="py-2 pr-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-white"
                    style={{ backgroundColor: a.colorHex }}
                  >
                    {a.categoryName}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-300">
                  {formatPLN(a.latestValue)}
                </td>
                <td className={`py-2 pr-3 text-right tabular-nums ${deltaClass}`}>
                  {delta == null ? "—" : formatPercent(delta)}
                </td>
                <td className="py-2 pr-3 text-slate-500">
                  {a.latestDate ? formatDate(a.latestDate) : "—"}
                </td>
                <td className="py-2 text-right">
                  <button
                    disabled={pending}
                    onClick={() =>
                      startTransition(() => {
                        void toggleAssetActive(a.id, !a.isActive);
                      })
                    }
                    className="mr-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/5 disabled:opacity-50"
                  >
                    {a.isActive ? "Ukryj" : "Pokaż"}
                  </button>
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (
                        confirm(
                          `Usunąć aktywo „${a.name}" i jego ${a.valuationCount} wycen?`
                        )
                      ) {
                        startTransition(() => {
                          void deleteAsset(a.id);
                        });
                      }
                    }}
                    className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                  >
                    Usuń
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
