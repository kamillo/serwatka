// Formatowanie pl-PL dla walut, liczb, procentów, dat.

export function formatPLN(value: number, opts?: { compact?: boolean }): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    notation: opts?.compact ? "compact" : "standard",
    maximumFractionDigits: opts?.compact ? 1 : 0,
  }).format(value);
}

export function formatNumber(value: number, compact = false): string {
  return new Intl.NumberFormat("pl-PL", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

/** Dzisiejsza data jako YYYY-MM-DD (dla <input type="date">). */
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Bieżący miesiąc jako YYYY-MM. */
export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Przesuwa miesiąc YYYY-MM o delta miesięcy. */
export function monthOffset(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const MONTHS_PL = [
  "styczeń", "luty", "marzec", "kwiecień", "maj", "czerwiec",
  "lipiec", "sierpień", "wrzesień", "październik", "listopad", "grudzień",
];

/** „lipiec 2026" z YYYY-MM. */
export function formatMonthPL(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_PL[(m - 1) % 12] ?? ""} ${y}`;
}

export type MonthRangePreset = "3M" | "6M" | "YTD" | "1Y" | "MAX";

/** Rozwiązuje preset zakresu miesięcy (względem refMonth, domyślnie bieżący). */
export function resolveMonthRange(
  preset: MonthRangePreset,
  refMonth = currentMonth()
): { from: string; to: string } {
  const to = refMonth;
  switch (preset) {
    case "3M":
      return { from: monthOffset(to, -2), to };
    case "6M":
      return { from: monthOffset(to, -5), to };
    case "YTD":
      return { from: `${to.slice(0, 4)}-01`, to };
    case "1Y":
      return { from: monthOffset(to, -11), to };
    case "MAX":
      return { from: "1900-01", to: "2999-12" };
  }
}
