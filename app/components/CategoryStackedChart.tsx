"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { Category } from "@prisma/client";
import type { SeriesPoint } from "@/lib/lkv";
import { formatPLN } from "@/lib/format";

export function CategoryStackedChart({
  series,
  categories,
}: {
  series: SeriesPoint[];
  categories: Category[];
}) {
  const cats = categories.filter((c) =>
    series.some((p) => (p.byCategory[c.slug] ?? 0) > 0)
  );

  if (series.length === 0 || cats.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-slate-500">
        Brak danych.
      </div>
    );
  }

  const option: EChartsOption = {
    grid: { left: 60, right: 16, top: 16, bottom: 54 },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v) => formatPLN(Number(v)),
    },
    legend: { bottom: 0, type: "scroll", textStyle: { color: "#94a3b8" } },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: series.map((p) => p.date),
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
    series: cats.map((c) => ({
      name: c.name,
      type: "line",
      stack: "total",
      smooth: true,
      showSymbol: false,
      areaStyle: { opacity: 0.55 },
      itemStyle: { color: c.colorHex },
      lineStyle: { color: c.colorHex, width: 1 },
      data: series.map((p) => Math.round(p.byCategory[c.slug] ?? 0)),
    })),
  };

  return <ReactECharts option={option} style={{ height: 280 }} notMerge />;
}
