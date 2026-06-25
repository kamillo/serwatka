// Kursy walut → PLN. Źródło: NBP API (tabela A, kursy średnie).
// Cache w fx_rates. Dla weekendu/święta (NBP publikuje dni robocze) — LKV kursu
// (najnowszy rateDate ≤ data), a przy braku w cache — walk-back po dniach.
import { prisma } from "./prisma";
import { addDays, startOfDayUTC, toDayKey } from "./lkv";

export type FxResult = { rate: number; rateDate: string };

const NBP = "https://api.nbp.pl/api/exchangerates/rates/a";
const HEADERS = { Accept: "application/json" } as const;

/** Kandydackie daty do walk-backu: [date, date-1, …, date-maxBack] (ISO YYYY-MM-DD). */
export function candidateDates(dateStr: string, maxBack = 7): string[] {
  const out: string[] = [];
  const d = startOfDayUTC(new Date(`${dateStr}T00:00:00.000Z`));
  for (let i = 0; i <= maxBack; i++) out.push(toDayKey(addDays(d, -i)));
  return out;
}

/** Pobiera kurs z NBP dla konkretnej daty (null = brak tabeli tego dnia). */
export async function fetchNbpRate(
  currency: string,
  dateStr: string
): Promise<FxResult | null> {
  const url = `${NBP}/${currency.toLowerCase()}/${dateStr}/?format=json`;
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return null;
    const json = await res.json();
    const r = json?.rates?.[0];
    if (!r || r.mid == null) return null;
    return { rate: Number(r.mid), rateDate: r.effectiveDate };
  } catch {
    return null;
  }
}

/** Pobiera serię kursów z NBP dla zakresu (max 93 dni na zapytanie). */
export async function fetchNbpRange(
  currency: string,
  startDateStr: string,
  endDateStr: string
): Promise<FxResult[]> {
  const url = `${NBP}/${currency.toLowerCase()}/${startDateStr}/${endDateStr}/?format=json`;
  try {
    const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.rates ?? []).map((r: { mid: number; effectiveDate: string }) => ({
      rate: Number(r.mid),
      rateDate: r.effectiveDate,
    }));
  } catch {
    return [];
  }
}

async function cacheRate(currency: string, rateDate: string, rate: number) {
  const dt = new Date(`${rateDate}T00:00:00.000Z`);
  await prisma.fxRate.upsert({
    where: { currency_rateDate_source: { currency, rateDate: dt, source: "NBP" } },
    create: { currency, rateDate: dt, rateToPln: rate, source: "NBP" },
    update: { rateToPln: rate },
  });
}

/**
 * Kurs waluty → PLN na dzień `dateStr`.
 * - PLN → 1.
 * - cache LKV (≤ data); jeśli świeży (≤7 dni) → zwraca.
 * - w przeciwnym razie walk-back po NBP (max 7 dni) aż do tabeli; cache.
 */
export async function getRateToPln(
  currency: string,
  dateStr: string
): Promise<FxResult> {
  if (currency === "PLN") return { rate: 1, rateDate: dateStr };

  const date = startOfDayUTC(new Date(`${dateStr}T00:00:00.000Z`));
  const cached = await prisma.fxRate.findFirst({
    where: { currency, rateDate: { lte: date } },
    orderBy: { rateDate: "desc" },
  });
  if (cached) {
    const diff = Math.round((date.getTime() - cached.rateDate.getTime()) / 86_400_000);
    if (diff <= 7) {
      return { rate: Number(cached.rateToPln), rateDate: toDayKey(cached.rateDate) };
    }
  }

  for (const cand of candidateDates(dateStr, 7)) {
    const r = await fetchNbpRate(currency, cand);
    if (r) {
      await cacheRate(currency, r.rateDate, r.rate);
      return r;
    }
  }
  // fallback: najnowszy dostępny w cache (nawet stary) — lepsze niż null
  if (cached) return { rate: Number(cached.rateToPln), rateDate: toDayKey(cached.rateDate) };
  return { rate: 1, rateDate: dateStr };
}

/** Konwertuje wartość na PLN: zwraca valuePln + dane kursu (do zapisu w wycenie/transakcji). */
export async function convertToPln(value: number, currency: string, dateStr: string) {
  const { rate, rateDate } = await getRateToPln(currency, dateStr);
  return {
    valuePln: value * rate,
    fxRateToPln: rate,
    fxRateDate: new Date(`${rateDate}T00:00:00.000Z`),
  };
}

/** Prefetch całego zakresu (chunki 90-dniowe) — dla importu wielu dat. */
export async function prefetchFxRange(
  currency: string,
  startDateStr: string,
  endDateStr: string
): Promise<void> {
  if (currency === "PLN") return;
  let start = startOfDayUTC(new Date(`${startDateStr}T00:00:00.000Z`));
  const end = startOfDayUTC(new Date(`${endDateStr}T00:00:00.000Z`));
  while (start <= end) {
    const chunkEnd = addDays(start, 90) < end ? addDays(start, 90) : end;
    const rates = await fetchNbpRange(currency, toDayKey(start), toDayKey(chunkEnd));
    for (const r of rates) await cacheRate(currency, r.rateDate, r.rate);
    start = addDays(chunkEnd, 1);
  }
}
