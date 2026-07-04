"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { MonthAggregate } from "@/lib/income";
import { formatPLN } from "@/lib/format";

export function IncomeChart({ series }: { series: MonthAggregate[] }) {
  if (series.length === 0) {
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
      data: series.map((s) => s.month),
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
    series: [
      {
        name: "Przychód",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: series.map((s) => Math.round(s.income)),
        lineStyle: { width: 2, color: "#94a3b8" },
        itemStyle: { color: "#94a3b8" },
      },
      {
        name: "Netto",
        type: "line",
        smooth: true,
        showSymbol: false,
        data: series.map((s) => Math.round(s.net)),
        areaStyle: { opacity: 0.18 },
        lineStyle: { width: 2.5, color: "#06B6D4" },
        itemStyle: { color: "#06B6D4" },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 260 }} notMerge />;
}
