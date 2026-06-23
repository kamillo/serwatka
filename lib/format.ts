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
