import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentUserId } from "./auth";
import {
  computeNetWorthSeries,
  diffDays,
  pickStepDays,
  type DateRange,
  type SeriesPoint,
  type ValuationPoint,
} from "./lkv";

export type RangePreset = "1M" | "6M" | "YTD" | "1Y" | "MAX";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1R" },
  { value: "MAX", label: "MAX" },
];

const toNum = (d: Prisma.Decimal | null | undefined): number =>
  d == null ? 0 : Number(d);

export function resolveRange(preset: RangePreset): DateRange {
  const end = new Date();
  const start = new Date(end);
  switch (preset) {
    case "1M":
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case "6M":
      start.setUTCDate(start.getUTCDate() - 180);
      break;
    case "YTD":
      start.setUTCMonth(0, 1);
      break;
    case "1Y":
      start.setUTCDate(start.getUTCDate() - 365);
      break;
    case "MAX":
      start.setUTCFullYear(2000, 0, 1);
      break;
  }
  return { start, end };
}

/** Wszystkie wyceny (aktywów aktywnych) jako punkty LKV. */
export async function getAllValuationPoints(): Promise<ValuationPoint[]> {
  const userId = await getCurrentUserId();
  const rows = await prisma.valuation.findMany({
    where: { userId, asset: { isActive: true } },
    include: { asset: { include: { category: true } } },
    orderBy: { valuationDate: "asc" },
  });
  return rows.map((r) => ({
    assetId: r.assetId,
    categorySlug: r.asset.category?.slug ?? null,
    valuePln: toNum(r.valuePln),
    date: r.valuationDate,
  }));
}

/** Szereg wartości netto dla danego zakresu (z auto-gęstością próbkowania). */
export async function getNetWorthSeries(preset: RangePreset): Promise<SeriesPoint[]> {
  const range = resolveRange(preset);
  const points = await getAllValuationPoints();
  const span = Math.max(1, diffDays(range.start, range.end));
  const step = pickStepDays(span);
  return computeNetWorthSeries(points, range, step);
}

export type AssetSnapshot = {
  id: string;
  name: string;
  categorySlug: string | null;
  categoryName: string;
  colorHex: string;
  currency: string;
  isActive: boolean;
  latestValue: number;
  latestDate: Date | null;
  prevValue: number | null;
  valuationCount: number;
};

/** Migawka bieżąca: najnowsza wycena per aktywo (do tabeli + donut). */
export async function getAssetsSnapshot(): Promise<AssetSnapshot[]> {
  const userId = await getCurrentUserId();
  const assets = await prisma.asset.findMany({
    where: { userId },
    include: { category: true, valuations: { orderBy: { valuationDate: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return assets.map((a) => {
    const vals = a.valuations;
    const latest = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    return {
      id: a.id,
      name: a.name,
      categorySlug: a.category?.slug ?? null,
      categoryName: a.category?.name ?? "Bez kategorii",
      colorHex: a.category?.colorHex ?? "#6b7280",
      currency: a.currency,
      isActive: a.isActive,
      latestValue: latest ? toNum(latest.valuePln) : 0,
      latestDate: latest?.valuationDate ?? null,
      prevValue: prev ? toNum(prev.valuePln) : null,
      valuationCount: vals.length,
    };
  });
}

export async function getCategories() {
  await getCurrentUserId(); // upewnia się, że dev user istnieje
  return prisma.category.findMany({ orderBy: { displayOrder: "asc" } });
}
