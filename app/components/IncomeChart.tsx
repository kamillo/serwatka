"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { IncomePersonSeries } from "@/lib/data";
import { formatPLN } from "@/lib/format";

export function IncomeChart({
  months,
  persons,
}: {
  months: string[];
  persons: IncomePersonSeries["persons"];
}) {
  if (months.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
        Brak wpisów dochodowych.
      </div>
    );
  }

  const option: EChartsOption = {
    grid: { left: 60, right: 16, top: 16, bottom: 40 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => formatPLN(Number(v)),
    },
    legend: { bottom: 0, textStyle: { color: "#94a3b8" } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: months,
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#94a3b8",
        formatter: (v) => formatPLN(Number(v), { compact: true }),
      },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: persons.map((p) => ({
      name: p.name,
      type: "line" as const,
      smooth: true,
      showSymbol: false,
      data: p.net.map((n) => Math.round(n)),
      lineStyle: { width: 2.5, color: p.colorHex },
      itemStyle: { color: p.colorHex },
      areaStyle: { opacity: 0.08 },
    })),
  };

  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
}
