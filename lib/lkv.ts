// Last Known Value — forward-fill dziennego szeregu wartości netto.
// Przenośny (TS), niezależny od generate_series/LATERAL → działa na SQLite i Postgres.
// Dla dnia bez wyceny aktywa: wartość = najnowsza wycena z daty ≤ ten dzień.

export type ValuationPoint = {
  assetId: string;
  categorySlug: string | null;
  valuePln: number;
  date: Date;
};

export type SeriesPoint = {
  date: string; // YYYY-MM-DD (UTC)
  total: number;
  byCategory: Record<string, number>; // categorySlug -> wartość PLN
};

export type DateRange = { start: Date; end: Date };

/** Normalizuje datę do północy UTC (obiekt daty wejściowej pozostaje nietknięty). */
export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function toDayKey(d: Date): string {
  return startOfDayUTC(d).toISOString().slice(0, 10);
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function diffDays(a: Date, b: Date): number {
  return Math.round((startOfDayUTC(b).getTime() - startOfDayUTC(a).getTime()) / 86_400_000);
}

/** Gęstość próbkowania szeregu w zależności od długości zakresu (dni). */
export function pickStepDays(daySpan: number): number {
  if (daySpan <= 90) return 1; // ≤3 mies: dziennie
  if (daySpan <= 365) return 3; // ≤1 rok: co 3 dni
  if (daySpan <= 1095) return 7; // ≤3 lata: co tydzień
  return 14; // więcej: co 2 tyg
}

/**
 * Buduje dzienny (lub rzadszy) szereg wartości netto z forward-fillem LKV.
 * - Dzień bez wyceny aktywa → przejmuje ostatnią znaną wartość.
 * - Aktywo z pierwszą wyceną późniejszą niż start → wpływa do sumy dopiero od tej daty.
 * - Serie zaczyna się od max(start, pierwsza wycena) — brak wiodących zer.
 */
export function computeNetWorthSeries(
  valuations: ValuationPoint[],
  range: DateRange,
  stepDays = 1
): SeriesPoint[] {
  if (valuations.length === 0) return [];
  if (stepDays < 1) stepDays = 1;

  // Grupa per aktywo, posortowana rosnąco; daty floorowane do północy UTC.
  const byAsset = new Map<string, ValuationPoint[]>();
  for (const v of valuations) {
    const list = byAsset.get(v.assetId) ?? [];
    list.push({ ...v, date: startOfDayUTC(v.date) });
    byAsset.set(v.assetId, list);
  }
  for (const list of byAsset.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  // Najwcześniejsza pierwsza-wycena wśród aktywów.
  let minFirst = byAsset.values().next().value![0].date;
  for (const list of byAsset.values()) {
    if (list[0].date < minFirst) minFirst = list[0].date;
  }
  const start = range.start > minFirst ? range.start : minFirst;
  const end = range.end;
  if (start > end) return [];

  const assets = [...byAsset.values()];
  const pointers = new Array<number>(assets.length).fill(-1);
  const points: SeriesPoint[] = [];

  for (
    let d = startOfDayUTC(start);
    d <= startOfDayUTC(end);
    d = addDays(d, stepDays)
  ) {
    const byCategory: Record<string, number> = {};
    let total = 0;

    for (let i = 0; i < assets.length; i++) {
      const list = assets[i];
      while (pointers[i] + 1 < list.length && list[pointers[i] + 1].date <= d) {
        pointers[i]++;
      }
      if (pointers[i] >= 0) {
        const v = list[pointers[i]];
        const cat = v.categorySlug ?? "other";
        total += v.valuePln;
        byCategory[cat] = (byCategory[cat] ?? 0) + v.valuePln;
      }
    }
    points.push({ date: toDayKey(d), total, byCategory });
  }
  return points;
}

/** Wartość w punkcie `daysAgo` dni wstecz od końca szeregu (do wyliczania delty KPI). */
export function valueAtOffset(series: SeriesPoint[], daysAgo: number): number | null {
  if (series.length === 0) return null;
  const last = series[series.length - 1];
  const target = addDays(new Date(last.date + "T00:00:00.000Z"), -daysAgo);
  let result: number | null = null;
  for (const p of series) {
    if (new Date(p.date + "T00:00:00.000Z") <= target) result = p.total;
  }
  return result;
}
