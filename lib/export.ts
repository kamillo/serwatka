// Eksport danych użytkownika (przenośność + backup).
import { prisma } from "./prisma";
import { getCurrentUserId } from "./auth";

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

export async function exportIncomeCsv(): Promise<string> {
  const userId = await getCurrentUserId();
  const rows = await prisma.incomeRecord.findMany({
    where: { userId },
    orderBy: [{ month: "asc" }, { personId: "asc" }],
    include: { person: true, expenses: true },
  });
  return toCsv(
    ["month", "person", "income", "vat", "pit", "zus", "expenses_total", "expenses_detail", "note"],
    rows.map((r) => {
      const expTotal = r.expenses.reduce((s, e) => s + Number(e.amount), 0);
      const detail = r.expenses.map((e) => `${e.type === "adjustment" ? "[wyr]" : ""}${e.label}:${Number(e.amount)}`).join("; ");
      return [
        r.month.toISOString().slice(0, 7),
        r.person.name,
        Number(r.income),
        Number(r.vat),
        Number(r.pit),
        Number(r.zus),
        expTotal,
        detail,
        r.note ?? "",
      ];
    })
  );
}
