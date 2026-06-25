"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import { formatPLN } from "@/lib/format";

export function AssetValuationChart({
  points,
}: {
  points: { date: string; value: number }[];
}) {
  if (points.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-gray-400">
        Brak wycen dla tego aktywa.
      </div>
    );
  }

  const option: EChartsOption = {
    grid: { left: 60, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: "axis", valueFormatter: (v) => formatPLN(Number(v)) },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: points.map((p) => p.date),
      axisLine: { lineStyle: { color: "#d1d5db" } },
      axisLabel: { color: "#9ca3af" },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#9ca3af",
        formatter: (v) => formatPLN(Number(v), { compact: true }),
      },
      splitLine: { lineStyle: { color: "#f3f4f6" } },
    },
    series: [
      {
        type: "line",
        smooth: true,
        showSymbol: false,
        data: points.map((p) => Math.round(p.value)),
        areaStyle: { opacity: 0.15 },
        lineStyle: { width: 2.5, color: "#3b82f6" },
        itemStyle: { color: "#3b82f6" },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: 220 }} notMerge />;
}
