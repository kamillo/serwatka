// Moduł Dochód — czyste obliczenia (bez DB).
// netto = przychód − podatek − ZUS − Σ innych wydatków.

// Paleta kolorów osób (UI). Tu, nie w pliku "use server".
export const PERSON_COLORS = ["#10b981", "#06b6d4", "#f59e0b", "#8b5cf6", "#ec4899", "#ef4444"];

export type ExpenseLine = { label: string; amount: number };

export function sumExpenses(expenses: ExpenseLine[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export type IncomeTotals = {
  net: number; // na rękę
  totalDeductions: number; // podatek + ZUS + wydatki
  totalExpenses: number; // tylko „inne wydatki"
  effectiveTaxRate: number | null; // podatek / przychód
};

export type IncomeLike = {
  income: number; // przychód
  tax: number; // podatek
  zus: number; // składki ZUS
  expenses: ExpenseLine[];
};

export function computeTotals(r: IncomeLike): IncomeTotals {
  const totalExpenses = sumExpenses(r.expenses);
  const totalDeductions = r.tax + r.zus + totalExpenses;
  const net = r.income - totalDeductions;
  const effectiveTaxRate = r.income > 0 ? r.tax / r.income : null;
  return { net, totalDeductions, totalExpenses, effectiveTaxRate };
}

export type MonthAggregate = {
  month: string; // YYYY-MM
  income: number;
  tax: number;
  zus: number;
  expenses: number;
  net: number;
};

/** Agreguje rekordy per miesiąc (suma po osobach), chronologicznie. */
export function aggregateByMonth(
  records: ({ month: string } & IncomeLike)[]
): MonthAggregate[] {
  const map = new Map<string, MonthAggregate>();
  for (const r of records) {
    const t = computeTotals(r);
    const cur =
      map.get(r.month) ??
      { month: r.month, income: 0, tax: 0, zus: 0, expenses: 0, net: 0 };
    cur.income += r.income;
    cur.tax += r.tax;
    cur.zus += r.zus;
    cur.expenses += t.totalExpenses;
    cur.net += t.net;
    map.set(r.month, cur);
  }
  return [...map.values()].sort((a, b) => (a.month < b.month ? -1 : a.month > b.month ? 1 : 0));
}
