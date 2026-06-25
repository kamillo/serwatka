import type { FieldKey, Preset } from "./presets";

export type TxType = "BUY" | "SELL" | "DIVIDEND" | "INTEREST" | "FEE";

/** Mapuje tekstowy typ transakcji (PL/EN) na enum. Domyślnie BUY. */
export function mapType(value: string): TxType {
  const s = (value ?? "").toLowerCase();
  if (/(sprzed|sell|verk)/.test(s)) return "SELL";
  if (/(dywidend|dividend)/.test(s)) return "DIVIDEND";
  if (/(odsetk|interest|coupon|kupon)/.test(s)) return "INTEREST";
  if (/(opłat|oplat|fee|commission|proviz|prowiz)/.test(s)) return "FEE";
  return "BUY";
}

export type CanonicalRow = {
  date: string | null; // ISO YYYY-MM-DD
  dateEstimated: boolean;
  amount: number | null; // zmiana (running balance) / wartość transakcji
  balance: number | null; // saldo bezpośrednie (snapshot)
  quantity: number | null; // sztuki / nominal
  price: number | null; // cena jednostkowa
  type: TxType; // typ transakcji
  currency: string;
  description: string;
  raw: Record<string, string>;
  errors: string[];
  warnings: string[];
};

/**
 * Parsuje datę wg formatu (tokeny DD/MM/YYYY w dowolnej kolejności).
 * Fallback: brak dnia (sam rok-miesiąc) → ostatni dzień miesiąca, estimated=true.
 * Zwraca iso=null, gdy nie da się ustalić.
 */
export function parseDate(
  value: string,
  format: string
): { iso: string | null; estimated: boolean } {
  const v = (value ?? "").trim();
  if (!v) return { iso: null, estimated: false };

  const numGroups = v.split(/[^0-9]+/).filter(Boolean);
  const fmt = format.toUpperCase().split(/[^DMY]+/).filter(Boolean);

  const token = (t: string): string | undefined => {
    const idx = fmt.indexOf(t);
    return idx >= 0 && idx < numGroups.length ? numGroups[idx] : undefined;
  };

  let dStr = token("DD");
  const mStr = token("MM");
  const yStr = token("YYYY");

  let estimated = false;
  // Fallback daty: brak dnia (tylko rok + miesiąc) → ostatni dzień miesiąca.
  if (!dStr && mStr && yStr) {
    estimated = true;
    const lastDay = new Date(Date.UTC(Number(yStr), Number(mStr), 0)).getUTCDate();
    dStr = String(lastDay);
  }

  if (!yStr || !mStr || !dStr) return { iso: null, estimated: false };

  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  if (m < 1 || m > 12 || d < 1 || d > 31) return { iso: null, estimated: false };

  const iso = `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(dt.getTime())) return { iso: null, estimated: false };
  // JS auto-przewija nieprawidłowe daty (np. 31.02 → 03.03). Wykryj przewinięcie.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) {
    return { iso: null, estimated: false };
  }
  return { iso, estimated };
}

/**
 * Parsuje kwotę: obsługa separatorów tysięcy/dziesiętnych, znaku minus i nawiasów (księgowe ujemne).
 * np. "1 234,56" → 1234.56, "(100,00)" → -100, "-50.25" → -50.25.
 */
export function parseAmount(
  value: string,
  decimalSeparator: "," | ".",
  thousandSeparator: string
): number | null {
  let v = (value ?? "").trim();
  if (!v) return null;

  const hasMinus = v.includes("-");
  const hasParens = /\(.*\)/.test(v);

  // zostaw tylko cyfry i separatory
  v = v.replace(/[^\d.,]/g, "");

  if (thousandSeparator) {
    const ts = thousandSeparator.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    v = v.replace(new RegExp(ts, "g"), "");
  }
  if (decimalSeparator === ",") v = v.replace(/,/g, ".");

  if (v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return hasMinus || hasParens ? -Math.abs(n) : n;
}

/** Buduje wiersze kanoniczne z surowych wierszy + mapowania pól + ustawień presetu. */
export function buildCanonicalRows(
  rows: Record<string, string>[],
  columnMap: Partial<Record<FieldKey, string>>,
  preset: Preset
): CanonicalRow[] {
  return rows.map((raw) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    const dateRaw = columnMap.date ? (raw[columnMap.date] ?? "").trim() : "";
    const { iso, estimated } = parseDate(dateRaw, preset.dateFormat);
    if (!iso) errors.push("Nieprawidłowa data");
    else if (estimated) warnings.push("Data niedokładna — przyjęto koniec miesiąca");

    const amount = columnMap.amount
      ? parseAmount(raw[columnMap.amount] ?? "", preset.decimalSeparator, preset.thousandSeparator)
      : null;
    if (columnMap.amount && amount == null) errors.push("Nieprawidłowa kwota");

    const balance = columnMap.balance
      ? parseAmount(raw[columnMap.balance] ?? "", preset.decimalSeparator, preset.thousandSeparator)
      : null;

    const quantity = columnMap.quantity
      ? parseAmount(raw[columnMap.quantity] ?? "", preset.decimalSeparator, preset.thousandSeparator)
      : null;
    const price = columnMap.price
      ? parseAmount(raw[columnMap.price] ?? "", preset.decimalSeparator, preset.thousandSeparator)
      : null;
    const type = columnMap.type ? mapType(raw[columnMap.type] ?? "") : "BUY";

    const currency = columnMap.currency
      ? ((raw[columnMap.currency] ?? "").trim().toUpperCase() || preset.defaultCurrency)
      : preset.defaultCurrency;

    const description = columnMap.description
      ? (raw[columnMap.description] ?? "").trim()
      : "";

    return {
      date: iso,
      dateEstimated: estimated,
      amount,
      balance,
      quantity,
      price,
      type,
      currency,
      description,
      raw,
      errors,
      warnings,
    };
  });
}

export type Summary = {
  total: number;
  withErrors: number;
  withWarnings: number;
  valid: number; // bez błędów
};

export function summarize(rows: CanonicalRow[]): Summary {
  let withErrors = 0;
  let withWarnings = 0;
  for (const r of rows) {
    if (r.errors.length > 0) withErrors++;
    else if (r.warnings.length > 0) withWarnings++;
  }
  return {
    total: rows.length,
    withErrors,
    withWarnings,
    valid: rows.length - withErrors,
  };
}
