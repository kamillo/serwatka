"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { AssetSnapshot } from "@/lib/data";
import { formatPLN } from "@/lib/format";

export function CategoryDonut({ assets }: { assets: AssetSnapshot[] }) {
  const byCat = new Map<string, { name: string; color: string; value: number }>();
  for (const a of assets) {
    if (!a.isActive || a.latestValue <= 0) continue;
    const key = a.categorySlug ?? "other";
    const e = byCat.get(key) ?? { name: a.categoryName, color: a.colorHex, value: 0 };
    e.value += a.latestValue;
    byCat.set(key, e);
  }
  const data = [...byCat.values()].sort((a, b) => b.value - a.value);

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-gray-400">
        Brak aktywów.
      </div>
    );
  }

  const option: EChartsOption = {
    tooltip: {
      trigger: "item",
      valueFormatter: (v) => formatPLN(Number(v)),
    },
    legend: { bottom: 0, type: "scroll", textStyle: { color: "#9ca3af" } },
    series: [
      {
        type: "pie",
        radius: ["45%", "70%"],
        center: ["50%", "45%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { formatter: "{d}%", color: "#6b7280" },
        data: data.map((d) => ({
          name: d.name,
          value: Math.round(d.value),
          itemStyle: { color: d.color },
        })),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 280 }} notMerge />;
}
