// Inflacja CPI m/m (GUS). Dane w lib/inflation/cpi.json są PRZYKŁADOWE (orientacyjne m/m);
// podmień na aktualne GUS przez panel /inflation lub edytując cpi.json + re-seed.
//
// cumulativeIndex[miesiąc] = ∏(1 + cpiMonthlyIndex) od miesiąca bazowego (base = 1).
// realValue = nominal / cumulativeIndex (deflacja do siły nabywczej miesiąca bazowego).

import cpiRaw from "./inflation/cpi.json";

export type RawCpi = { month: string; rate: number };
export type InflationPoint = {
  month: string; // YYYY-MM
  cpiMonthlyIndex: number;
  cumulativeIndex: number;
  source?: string;
};

export const INFLATION_DATA: RawCpi[] = cpiRaw as RawCpi[];

/** Buduje szeregi z cumulativeIndex (miesiąc bazowy = 1.000). */
export function buildCumulative(data: RawCpi[] = INFLATION_DATA): InflationPoint[] {
  const sorted = [...data].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
  let cum = 1;
  return sorted.map((d, i) => {
    if (i > 0) cum *= 1 + d.rate; // base month (i=0) zostaje 1
    return { month: d.month, cpiMonthlyIndex: d.rate, cumulativeIndex: cum };
  });
}

/** Skumulowany index dla daty (LKV miesiąca: najnowszy miesiąc ≤ dana data). */
export function cumulativeForDate(points: InflationPoint[], dateStr: string): number {
  const ym = dateStr.slice(0, 7);
  let result = 1;
  let found = false;
  for (const p of points) {
    if (p.month <= ym) {
      result = p.cumulativeIndex;
      found = true;
    }
  }
  return found ? result : 1;
}

export type NominalPoint = { date: string; total: number };

/**
 * Buduje warianty szeregu dla wykresu (wszystkie zakotwiczone w pierwszej dacie):
 * - nominal: wartość nominalna
 * - real: total * cum[firstDate] / cum[date]  (stała siła nabywcza od startu)
 * - inflation: firstTotal * cum[date] / cum[firstDate]  (ile trzeba by było, by nie stracić na inflacji)
 */
export function buildChartSeries(
  nominal: NominalPoint[],
  inflation: InflationPoint[]
): { dates: string[]; nominal: number[]; real: number[]; inflationLine: number[] } {
  if (nominal.length === 0) {
    return { dates: [], nominal: [], real: [], inflationLine: [] };
  }
  const firstDate = nominal[0].date;
  const cumFirst = cumulativeForDate(inflation, firstDate);
  const firstTotal = nominal[0].total || 1;

  const dates: string[] = [];
  const nom: number[] = [];
  const real: number[] = [];
  const infl: number[] = [];
  for (const p of nominal) {
    const cum = cumulativeForDate(inflation, p.date);
    dates.push(p.date);
    nom.push(Math.round(p.total));
    real.push(Math.round((p.total * cumFirst) / cum));
    infl.push(Math.round((firstTotal * cum) / cumFirst));
  }
  return { dates, nominal: nom, real, inflationLine: infl };
}
