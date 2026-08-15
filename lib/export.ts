// Eksport danych użytkownika (przenośność + backup).
import { prisma } from "./prisma";
import { getCurrentUserId } from "./auth";
import { sumExpenses, type ExpenseLine } from "./income";

function csvEscape(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: (string | number)[][]): string {
  return [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

/** Peły eksport jako JSON (liczby zamiast Decimal). */
export async function exportJson() {
  const userId = await getCurrentUserId();
  const [assets, valuations, transactions, categories, importJobs] = await Promise.all([
    prisma.asset.findMany({ where: { userId }, include: { category: true } }),
    prisma.valuation.findMany({ where: { userId }, orderBy: { valuationDate: "asc" } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    prisma.category.findMany(),
    prisma.importJob.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const n = (d: { toNumber(): number } | null) => (d ? d.toNumber() : null);
  const day = (d: Date) => d.toISOString().slice(0, 10);

  return {
    exportedAt: new Date().toISOString(),
    categories,
    assets: assets.map((a) => ({
      id: a.id,
      name: a.name,
      category: a.category?.slug ?? null,
      currency: a.currency,
      isActive: a.isActive,
      createdAt: a.createdAt.toISOString(),
    })),
    valuations: valuations.map((v) => ({
      date: day(v.valuationDate),
      assetId: v.assetId,
      currency: v.currency,
      valueOriginal: n(v.valueOriginal),
      valuePln: n(v.valuePln),
      fxRateToPln: n(v.fxRateToPln),
      fxRateDate: v.fxRateDate ? day(v.fxRateDate) : null,
      source: v.source,
      note: v.note,
    })),
    transactions: transactions.map((t) => ({
      date: day(t.date),
      assetId: t.assetId,
      type: t.type,
      quantity: n(t.quantity),
      price: n(t.price),
      amount: n(t.amount),
      currency: t.currency,
      valuePln: n(t.valuePln),
      note: t.note,
      source: t.source,
    })),
    importJobs: importJobs.map((j) => ({
      filename: j.filename,
      sourceType: j.sourceType,
      status: j.status,
      rowsTotal: j.rowsTotal,
      rowsImported: j.rowsImported,
      rowsSkipped: j.rowsSkipped,
      createdAt: j.createdAt.toISOString(),
    })),
  };
}

export async function exportValuationsCsv(): Promise<string> {
  const userId = await getCurrentUserId();
  const rows = await prisma.valuation.findMany({
    where: { userId },
    orderBy: [{ valuationDate: "asc" }, { assetId: "asc" }],
    include: { asset: { select: { name: true } } },
  });
  return toCsv(
    ["date", "asset", "currency", "valueOriginal", "valuePln", "fxRateToPln", "source", "note"],
    rows.map((v) => [
      v.valuationDate.toISOString().slice(0, 10),
      v.asset.name,
      v.currency,
      Number(v.valueOriginal),
      Number(v.valuePln),
      v.fxRateToPln ? Number(v.fxRateToPln) : "",
      v.source,
      v.note ?? "",
    ])
  );
}

export async function exportTransactionsCsv(): Promise<string> {
  const userId = await getCurrentUserId();
  const rows = await prisma.transaction.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { assetId: "asc" }],
    include: { asset: { select: { name: true } } },
  });
  return toCsv(
    ["date", "asset", "type", "quantity", "price", "amount", "currency", "valuePln", "note"],
    rows.map((t) => [
      t.date.toISOString().slice(0, 10),
      t.asset.name,
      t.type,
      t.quantity ? Number(t.quantity) : "",
      t.price ? Number(t.price) : "",
      Number(t.amount),
      t.currency,
      Number(t.valuePln),
      t.note ?? "",
    ])
  );
}

export type IncomeCsvRecord = {
  month: string; // YYYY-MM
  person: string;
  income: number;
  vat: number;
  pit: number;
  zus: number;
  note: string;
  expenses: ExpenseLine[];
};

/** Buduje CSV dochodu: każdy unikalny (typ, etykieta) wydatku/wyrównania to osobna kolumna. */
export function buildIncomeCsv(records: IncomeCsvRecord[]): string {
  const header = (type: string, label: string) => `${type}:${label}`;

  const columns: { type: string; label: string; header: string }[] = [];
  const seen = new Set<string>();
  for (const r of records) {
    for (const e of r.expenses) {
      const type = e.type ?? "expense";
      const key = `${type}|${e.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push({ type, label: e.label, header: header(type, e.label) });
    }
  }
  columns.sort((a, b) =>
    a.type === b.type ? a.label.localeCompare(b.label) : a.type === "expense" ? -1 : 1
  );

  const headers = ["month", "person", "income", "vat", "pit", "zus", "expenses_total", ...columns.map((c) => c.header), "note"];

  const rows = records.map((r) => {
    const total = sumExpenses(r.expenses);
    const cell = (c: { type: string; label: string }) => {
      const matches = r.expenses.filter(
        (e) => (e.type ?? "expense") === c.type && e.label === c.label
      );
      if (matches.length === 0) return "";
      return matches.reduce((s, e) => s + e.amount, 0);
    };
    return [
      r.month,
      r.person,
      r.income,
      r.vat,
      r.pit,
      r.zus,
      total,
      ...columns.map(cell),
      r.note,
    ];
  });

  return toCsv(headers, rows);
}

export async function exportIncomeCsv(): Promise<string> {
  const userId = await getCurrentUserId();
  const rows = await prisma.incomeRecord.findMany({
    where: { userId },
    orderBy: [{ month: "asc" }, { personId: "asc" }],
    include: { person: true, expenses: true },
  });
  return buildIncomeCsv(
    rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      person: r.person.name,
      income: Number(r.income),
      vat: Number(r.vat),
      pit: Number(r.pit),
      zus: Number(r.zus),
      note: r.note ?? "",
      expenses: r.expenses.map((e) => ({
        label: e.label,
        amount: Number(e.amount),
        type: e.type === "adjustment" ? ("adjustment" as const) : ("expense" as const),
      })),
    }))
  );
}
