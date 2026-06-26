"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { CompareAsset } from "@/lib/data";

export function CompareChart({ assets }: { assets: CompareAsset[] }) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(assets.slice(0, 3).map((a) => a.id))
  );

  const option = useMemo<EChartsOption>(() => {
    const chosen = assets.filter((a) => selected.has(a.id));
    const dateSet = new Set<string>();
    for (const a of chosen) for (const p of a.points) dateSet.add(p.date);
    const dates = [...dateSet].sort();

    const series = chosen.map((a) => {
      const first = a.points[0]?.value || 1;
      const byDate = new Map(a.points.map((p) => [p.date, p.value]));
      return {
        type: "line" as const,
        name: a.name,
        connectNulls: true,
        showSymbol: false,
        smooth: true,
        lineStyle: { color: a.colorHex, width: 2 },
        itemStyle: { color: a.colorHex },
        data: dates.map((d) => {
          const v = byDate.get(d);
          return v == null ? null : Math.round((v / first) * 100);
        }),
      };
    });

    return {
      grid: { left: 50, right: 16, top: 16, bottom: 48 },
      tooltip: { trigger: "axis" },
      legend: { bottom: 0, textStyle: { color: "#94a3b8" } },
      xAxis: {
        type: "category",
        boundaryGap: false,
        data: dates,
        axisLabel: { color: "#94a3b8" },
      },
      yAxis: {
        type: "value",
        name: "start = 100",
        axisLabel: { color: "#94a3b8" },
        splitLine: { lineStyle: { color: "#1e293b" } },
      },
      series,
    };
  }, [assets, selected]);

  function toggle(id: string) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (assets.length < 2) {
    return (
      <p className="py-6 text-center text-sm text-slate-500">
        Potrzeba min. 2 aktywów z wycenami do porównania.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {assets.map((a) => (
          <button
            key={a.id}
            onClick={() => toggle(a.id)}
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${
              selected.has(a.id)
                ? "border-white/10 bg-white/10 text-slate-100"
                : "border-transparent text-slate-500 hover:text-slate-300"
            }`}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: selected.has(a.id) ? a.colorHex : "#334155" }}
            />
            {a.name}
          </button>
        ))}
      </div>
      <ReactECharts option={option} style={{ height: 360 }} notMerge />
    </div>
  );
}
