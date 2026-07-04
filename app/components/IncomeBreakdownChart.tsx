"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { MonthAggregate } from "@/lib/income";
import { formatPLN } from "@/lib/format";

export function IncomeBreakdownChart({ series }: { series: MonthAggregate[] }) {
  if (series.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
        Brak wpisów dochodowych.
      </div>
    );
  }

  const option: EChartsOption = {
    grid: { left: 60, right: 16, top: 16, bottom: 40 },
    tooltip: { trigger: "axis", valueFormatter: (v) => formatPLN(Number(v)) },
    legend: { bottom: 0, textStyle: { color: "#94a3b8" } },
    xAxis: {
      type: "category",
      data: series.map((s) => s.month),
      axisLine: { lineStyle: { color: "#334155" } },
      axisLabel: { color: "#94a3b8" },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: (v) => formatPLN(Number(v), { compact: true }) },
      splitLine: { lineStyle: { color: "#1e293b" } },
    },
    series: [
      bar("Netto", series.map((s) => Math.round(s.net)), "#06B6D4"),
      bar("Podatek", series.map((s) => Math.round(s.tax)), "#f59e0b"),
      bar("ZUS", series.map((s) => Math.round(s.zus)), "#8b5cf6"),
      bar("Wydatki", series.map((s) => Math.round(s.expenses)), "#94a3b8"),
    ],
  };

  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
}

function bar(name: string, data: number[], color: string) {
  return { name, type: "bar" as const, stack: "przychod", data, itemStyle: { color } };
}
