// Eurostat HICP — miesięczny indeks cen dla Polski (base 2015=100).
// Źródło: ec.europa.eu/eurostat API (SDMX-JSON), BEZ klucza.
// Dataset prc_hicp_midx, unit=I15 (index), coicop=CP00 (all-items), geo=PL, freq=M.
// m/m liczymy z kolejnych indeksów (prawdziwa miesięczna zmiana, nie roczny-distributed).

const URL =
  "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/prc_hicp_midx?freq=M&unit=I15&coicop=CP00&geo=PL&format=JSON";

export type HicpPoint = { month: string; index: number };

/** Pobiera miesięczne indeksy HICP dla Polski (chronologicznie). */
export async function fetchEurostatHicp(): Promise<HicpPoint[]> {
  const res = await fetch(URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`Eurostat HTTP ${res.status}`);
  const d = await res.json();
  const timeIndex: Record<string, number> = d?.dimension?.time?.category?.index ?? {};
  const value: Record<string, number | string> = d?.value ?? {};

  const entries = Object.entries(timeIndex).sort((a, b) =>
    a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0
  );
  const out: HicpPoint[] = [];
  for (const [month, idx] of entries) {
    const v = value[idx];
    if (v != null && v !== "") out.push({ month, index: Number(v) });
  }
  return out;
}

/** Liczy miesięczne stopy m/m (ułamek) z szeregu indeksów. Pierwszy = 0 (base). */
export function indicesToMonthlyRates(points: HicpPoint[]): { month: string; rate: number }[] {
  return points.map((p, i) => ({
    month: p.month,
    rate: i === 0 ? 0 : p.index / points[i - 1].index - 1,
  }));
}
