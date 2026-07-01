"use client";

import { useState } from "react";
import Link from "next/link";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { AssetSnapshot } from "@/lib/data";
import { formatPLN } from "@/lib/format";

type CatSlice = { slug: string; name: string; color: string; value: number };

export function CategoryDonut({ assets }: { assets: AssetSnapshot[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  const byCat = new Map<string, CatSlice>();
  for (const a of assets) {
    if (!a.isActive || a.latestValue <= 0) continue;
    const key = a.categorySlug ?? "other";
    const e = byCat.get(key) ?? { slug: key, name: a.categoryName, color: a.colorHex, value: 0 };
    e.value += a.latestValue;
    byCat.set(key, e);
  }
  const data = [...byCat.values()].sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-slate-500">
        Brak aktywów.
      </div>
    );
  }

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      valueFormatter: (v) => formatPLN(Number(v)),
    },
    legend: { bottom: 0, type: "scroll", textStyle: { color: "#94a3b8" } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "40%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#0f172a", borderWidth: 2 },
        label: { formatter: "{d}%", color: "#94a3b8" },
        data: data.map((d) => ({
          name: d.name,
          value: Math.round(d.value),
          slug: d.slug,
          itemStyle: {
            color: d.color,
            opacity: selected == null || selected === d.slug ? 1 : 0.25,
          },
        })),
      },
    ],
  };

  function onChartClick(p: { data?: { slug?: string } }) {
    const slug = p?.data?.slug;
    if (!slug) return;
    setSelected((prev) => (prev === slug ? null : slug));
  }

  const selectedCat = selected ? byCat.get(selected) : null;
  const selectedAssets = selected
    ? assets
        .filter(
          (a) => a.isActive && a.latestValue > 0 && (a.categorySlug ?? "other") === selected
        )
        .sort((a, b) => b.latestValue - a.latestValue)
    : [];

  return (
    <div>
      <ReactECharts
        option={option}
        style={{ height: 300 }}
        notMerge
        onEvents={{ click: onChartClick }}
      />
      <p className="-mt-1 mb-2 text-center text-xs text-slate-500">
        {selectedCat
          ? "Aktywa w kategorii"
          : "Kliknij kategorię, aby zobaczyć aktywa"}
      </p>

      {selectedCat && (
        <ul className="space-y-1.5">
          {selectedAssets.map((a) => {
            const share = selectedCat.value > 0 ? (a.latestValue / selectedCat.value) * 100 : 0;
            return (
              <li key={a.id} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  href={`/assets/${a.id}`}
                  className="truncate text-slate-200 hover:text-emerald-400 hover:underline"
                >
                  {a.name}
                </Link>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {formatPLN(a.latestValue)}
                  <span className="ml-2 text-xs text-slate-600">{share.toFixed(1)}%</span>
                </span>
              </li>
            );
          })}
          {selectedAssets.length === 0 && (
            <li className="text-sm text-slate-500">Brak aktywów.</li>
          )}
        </ul>
      )}
    </div>
  );
}
