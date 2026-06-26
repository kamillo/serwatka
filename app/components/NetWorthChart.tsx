"use client";

import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { EChartsOption } from "echarts";
import type { SeriesPoint } from "@/lib/lkv";
import type { InflationPoint } from "@/lib/inflation";
import { buildChartSeries } from "@/lib/inflation";
import { formatPLN } from "@/lib/format";

type Props = { series: SeriesPoint[]; inflation?: InflationPoint[] };

export function NetWorthChart({ series, inflation }: Props) {
  const hasInflation = !!inflation && inflation.length > 0;
  const [show, setShow] = useState({
    nominal: true,
    real: false,
    inflation: false,
  });

  const chart = useMemo(
    () => (hasInflation ? buildChartSeries(series, inflation!) : null),
    [series, inflation, hasInflation]
  );

  if (series.length === 0) {
    return (
      <div className="flex h-[340px] items-center justify-center text-slate-500">
        Brak danych w tym zakresie.
      </div>
    );
  }

  const dates = series.map((p) => p.date);
  const seriesArr: NonNullable<EChartsOption["series"]> = [];

  if (!hasInflation) {
    seriesArr.push({
      type: "line",
      name: "Nominalnie",
      smooth: true,
      showSymbol: false,
      data: series.map((p) => Math.round(p.total)),
      areaStyle: { opacity: 0.15 },
      lineStyle: { width: 2.5, color: "#06B6D4" },
      itemStyle: { color: "#06B6D4" },
    });
  } else {
    const c = chart!;
    if (show.nominal)
      seriesArr.push(lineSeries("Nominalnie", c.nominal, "#06B6D4", true));
    if (show.real)
      seriesArr.push(lineSeries("Realnie (po inflacji)", c.real, "#10b981", false));
    if (show.inflation)
      seriesArr.push(lineSeries("Inflacja", c.inflationLine, "#94a3b8", false, true));
  }

  const option: EChartsOption = {
    grid: { left: 60, right: 16, top: 16, bottom: 48 },
    tooltip: { trigger: "axis", valueFormatter: (v) => formatPLN(Number(v)) },
    legend: hasInflation ? { bottom: 0, textStyle: { color: "#94a3b8" } } : undefined,
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: dates,
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
    series: seriesArr,
  };

  return (
    <div>
      {hasInflation && (
        <div className="mb-2 flex flex-wrap gap-3 text-xs">
          <Toggle label="Nominalnie" color="#06B6D4" on={show.nominal} onClick={() => setShow((s) => ({ ...s, nominal: !s.nominal }))} />
          <Toggle label="Realnie (po inflacji)" color="#10b981" on={show.real} onClick={() => setShow((s) => ({ ...s, real: !s.real }))} />
          <Toggle label="Inflacja" color="#94a3b8" on={show.inflation} onClick={() => setShow((s) => ({ ...s, inflation: !s.inflation }))} />
        </div>
      )}
      <ReactECharts option={option} style={{ height: 340 }} notMerge />
    </div>
  );
}

function lineSeries(
  name: string,
  data: number[],
  color: string,
  area: boolean,
  dashed = false
) {
  return {
    type: "line" as const,
    name,
    smooth: true,
    showSymbol: false,
    data,
    areaStyle: area ? { opacity: 0.15 } : undefined,
    lineStyle: { width: 2.5, color, type: dashed ? ("dashed" as const) : ("solid" as const) },
    itemStyle: { color },
  };
}

function Toggle({
  label,
  color,
  on,
  onClick,
}: {
  label: string;
  color: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 ${
        on
          ? "border-white/10 bg-white/10 text-slate-100"
          : "border-transparent text-slate-500 hover:text-slate-300"
      }`}
    >
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? color : "#334155" }} />
      {label}
    </button>
  );
}
