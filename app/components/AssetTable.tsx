"use client";

import { useTransition } from "react";
import { deleteAsset, toggleAssetActive } from "@/lib/actions/assets";
import type { AssetSnapshot } from "@/lib/data";
import { formatDate, formatPercent, formatPLN } from "@/lib/format";

export function AssetTable({ assets }: { assets: AssetSnapshot[] }) {
  const [pending, startTransition] = useTransition();

  if (assets.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-gray-400">
        Brak aktywów. Dodaj pierwsze poniżej.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800">
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
                ? "text-gray-400"
                : delta >= 0
                  ? "text-emerald-600"
                  : "text-red-600";
            return (
              <tr
                key={a.id}
                className={`border-b border-gray-100 dark:border-neutral-800/60 ${
                  a.isActive ? "" : "opacity-50"
                }`}
              >
                <td className="py-2 pr-3 font-medium">{a.name}</td>
                <td className="py-2 pr-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs text-white"
                    style={{ backgroundColor: a.colorHex }}
                  >
                    {a.categoryName}
                  </span>
                </td>
                <td className="py-2 pr-3 text-right tabular-nums">
                  {formatPLN(a.latestValue)}
                </td>
                <td className={`py-2 pr-3 text-right tabular-nums ${deltaClass}`}>
                  {delta == null ? "—" : formatPercent(delta)}
                </td>
                <td className="py-2 pr-3 text-gray-500">
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
                    className="mr-2 text-xs text-gray-500 hover:text-gray-800 disabled:opacity-50"
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
                    className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
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
