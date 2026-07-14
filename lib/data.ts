import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentUserId } from "./auth";
import {
  computeNetWorthSeries,
  diffDays,
  pickStepDays,
  type DateRange,
  type SeriesPoint,
  type ValuationPoint,
} from "./lkv";
import type { InflationPoint } from "./inflation";
import { resolveMonthRange } from "./format";
import { aggregateByMonth, computeTotals, type MonthAggregate, type ExpenseType } from "./income";

export type RangePreset = "1M" | "6M" | "YTD" | "1Y" | "MAX";

export const RANGE_PRESETS: { value: RangePreset; label: string }[] = [
  { value: "1M", label: "1M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1R" },
  { value: "MAX", label: "MAX" },
];

const toNum = (d: Prisma.Decimal | null | undefined): number =>
  d == null ? 0 : Number(d);

export function resolveRange(preset: RangePreset): DateRange {
  const end = new Date();
  const start = new Date(end);
  switch (preset) {
    case "1M":
      start.setUTCDate(start.getUTCDate() - 30);
      break;
    case "6M":
      start.setUTCDate(start.getUTCDate() - 180);
      break;
    case "YTD":
      start.setUTCMonth(0, 1);
      break;
    case "1Y":
      start.setUTCDate(start.getUTCDate() - 365);
      break;
    case "MAX":
      start.setUTCFullYear(2000, 0, 1);
      break;
  }
  return { start, end };
}

/** Wszystkie wyceny (aktywów aktywnych) jako punkty LKV. */
export async function getAllValuationPoints(): Promise<ValuationPoint[]> {
  const userId = await getCurrentUserId();
  const rows = await prisma.valuation.findMany({
    where: { userId, asset: { isActive: true } },
    include: { asset: { include: { category: true } } },
    orderBy: { valuationDate: "asc" },
  });
  return rows.map((r) => ({
    assetId: r.assetId,
    categorySlug: r.asset.category?.slug ?? null,
    valuePln: toNum(r.valuePln),
    date: r.valuationDate,
  }));
}

/** Szereg wartości netto dla danego zakresu (z auto-gęstością próbkowania). */
export async function getNetWorthSeries(preset: RangePreset): Promise<SeriesPoint[]> {
  const range = resolveRange(preset);
  const points = await getAllValuationPoints();
  const span = Math.max(1, diffDays(range.start, range.end));
  const step = pickStepDays(span);
  return computeNetWorthSeries(points, range, step);
}

export type AssetSnapshot = {
  id: string;
  name: string;
  categorySlug: string | null;
  categoryName: string;
  colorHex: string;
  currency: string;
  isActive: boolean;
  latestValue: number;
  latestDate: Date | null;
  prevValue: number | null;
  valuationCount: number;
};

/** Migawka bieżąca: najnowsza wycena per aktywo (do tabeli + donut). */
export async function getAssetsSnapshot(): Promise<AssetSnapshot[]> {
  const userId = await getCurrentUserId();
  const assets = await prisma.asset.findMany({
    where: { userId },
    include: { category: true, valuations: { orderBy: { valuationDate: "asc" } } },
    orderBy: { createdAt: "asc" },
  });
  return assets.map((a) => {
    const vals = a.valuations;
    const latest = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    return {
      id: a.id,
      name: a.name,
      categorySlug: a.category?.slug ?? null,
      categoryName: a.category?.name ?? "Bez kategorii",
      colorHex: a.category?.colorHex ?? "#6b7280",
      currency: a.currency,
      isActive: a.isActive,
      latestValue: latest ? toNum(latest.valuePln) : 0,
      latestDate: latest?.valuationDate ?? null,
      prevValue: prev ? toNum(prev.valuePln) : null,
      valuationCount: vals.length,
    };
  });
}

export async function getCategories() {
  await getCurrentUserId(); // upewnia się, że dev user istnieje
  return prisma.category.findMany({ orderBy: { displayOrder: "asc" } });
}

export type AssetDetail = {
  id: string;
  name: string;
  categoryName: string;
  colorHex: string;
  currency: string;
  isActive: boolean;
  valuations: { date: string; value: number }[];
  transactions: {
    id: string;
    type: "BUY" | "SELL" | "DIVIDEND" | "INTEREST" | "FEE";
    date: string;
    quantity: number | null;
    price: number | null;
    amount: number;
    note: string | null;
  }[];
};

/** Szczegóły aktywa: wyceny (mini-wykres) + transakcje (ROI). */
export async function getAssetDetail(assetId: string): Promise<AssetDetail | null> {
  const userId = await getCurrentUserId();
  const asset = await prisma.asset.findFirst({
    where: { id: assetId, userId },
    include: {
      category: true,
      valuations: { orderBy: { valuationDate: "asc" } },
      transactions: { orderBy: { date: "asc" } },
    },
  });
  if (!asset) return null;
  return {
    id: asset.id,
    name: asset.name,
    categoryName: asset.category?.name ?? "Bez kategorii",
    colorHex: asset.category?.colorHex ?? "#6b7280",
    currency: asset.currency,
    isActive: asset.isActive,
    valuations: asset.valuations.map((v) => ({
      date: v.valuationDate.toISOString().slice(0, 10),
      value: Number(v.valuePln),
    })),
    transactions: asset.transactions.map((t) => ({
      id: t.id,
      type: t.type,
      date: t.date.toISOString().slice(0, 10),
      quantity: t.quantity == null ? null : Number(t.quantity),
      price: t.price == null ? null : Number(t.price),
      amount: Number(t.amount),
      note: t.note,
    })),
  };
}

/** Szereg inflacji (cumulativeIndex) z bazy — do wykresu realnego i reportów. */
export async function getInflationSeries(): Promise<InflationPoint[]> {
  await getCurrentUserId();
  const rows = await prisma.macroInflation.findMany({ orderBy: { month: "asc" } });
  return rows.map((r) => ({
    month: r.month.toISOString().slice(0, 7),
    cpiMonthlyIndex: Number(r.cpiMonthlyIndex),
    cumulativeIndex: Number(r.cumulativeIndex),
    source: r.source,
  }));
}

export type CompareAsset = {
  id: string;
  name: string;
  colorHex: string;
  points: { date: string; value: number }[];
};

/** Aktywa z punktami wycen — do wykresu porównawczego (znormalizowanego). */
export async function getCompareAssets(): Promise<CompareAsset[]> {
  const userId = await getCurrentUserId();
  const assets = await prisma.asset.findMany({
    where: { userId, isActive: true },
    include: { category: true, valuations: { orderBy: { valuationDate: "asc" } } },
  });
  return assets
    .map((a) => ({
      id: a.id,
      name: a.name,
      colorHex: a.category?.colorHex ?? "#6b7280",
      points: a.valuations.map((v) => ({
        date: v.valuationDate.toISOString().slice(0, 10),
        value: Number(v.valuePln),
      })),
    }))
    .filter((a) => a.points.length > 0);
}

// --- Moduł Dochód ---

export type PersonView = { id: string; name: string; colorHex: string; order: number };

export async function getPeople(): Promise<PersonView[]> {
  const userId = await getCurrentUserId();
  const people = await prisma.person.findMany({
    where: { userId },
    orderBy: { order: "asc" },
  });
  return people.map((p) => ({ id: p.id, name: p.name, colorHex: p.colorHex, order: p.order }));
}

export type IncomeRecordView = {
  id: string;
  personId: string;
  month: string; // YYYY-MM
  income: number;
  vat: number;
  pit: number;
  zus: number;
  note: string | null;
  expenses: { label: string; amount: number; type: ExpenseType }[];
};

type IncomeRecordRow = {
  id: string;
  personId: string;
  month: Date;
  income: Prisma.Decimal;
  vat: Prisma.Decimal;
  pit: Prisma.Decimal;
  zus: Prisma.Decimal;
  note: string | null;
  expenses: { label: string; amount: Prisma.Decimal; type: string }[];
};

function incomeRecordToView(r: IncomeRecordRow): IncomeRecordView {
  return {
    id: r.id,
    personId: r.personId,
    month: r.month.toISOString().slice(0, 7),
    income: Number(r.income),
    vat: Number(r.vat),
    pit: Number(r.pit),
    zus: Number(r.zus),
    note: r.note,
    expenses: r.expenses.map((e) => ({
      label: e.label,
      amount: Number(e.amount),
      type: (e.type === "adjustment" ? "adjustment" : "expense") as ExpenseType,
    })),
  };
}

/** Rekordy dochodowe dla danego miesiąca (z wydatkami). */
export async function getIncomeRecords(month: string): Promise<IncomeRecordView[]> {
  const userId = await getCurrentUserId();
  const monthDate = new Date(`${month}-01T00:00:00.000Z`);
  const rows = await prisma.incomeRecord.findMany({
    where: { userId, month: monthDate },
    include: { expenses: true },
  });
  return rows.map(incomeRecordToView);
}

/** Mapa personId → rekord dla miesiąca (do prefill formularza). */
export async function getIncomeRecordByPerson(
  month: string
): Promise<Record<string, IncomeRecordView>> {
  const rows = await getIncomeRecords(month);
  const map: Record<string, IncomeRecordView> = {};
  for (const r of rows) map[r.personId] = r;
  return map;
}

/** Serie miesięczne dochodu (suma po osobach), chronologicznie. */
export async function getIncomeSeries(): Promise<MonthAggregate[]> {
  const userId = await getCurrentUserId();
  const rows = await prisma.incomeRecord.findMany({
    where: { userId },
    include: { expenses: true },
    orderBy: { month: "asc" },
  });
  return aggregateByMonth(rows.map(incomeRecordToView));
}

export type IncomePersonSeries = {
  months: string[]; // posortowane YYYY-MM
  persons: { personId: string; name: string; colorHex: string; net: number[] }[];
};

/** Seria miesięcznego dochodu netto per osoba (do wykresu liniowego). */
export async function getIncomeSeriesByPerson(): Promise<IncomePersonSeries> {
  const userId = await getCurrentUserId();
  const records = await prisma.incomeRecord.findMany({
    where: { userId },
    include: { person: true, expenses: true },
    orderBy: { month: "asc" },
  });

  const monthSet = new Set<string>();
  const netByPerson = new Map<string, Map<string, number>>(); // personId -> month -> net
  const meta = new Map<string, { name: string; colorHex: string; order: number }>();

  for (const r of records) {
    const m = r.month.toISOString().slice(0, 7);
    monthSet.add(m);
    const net = computeTotals(incomeRecordToView(r)).net;
    if (!netByPerson.has(r.personId)) netByPerson.set(r.personId, new Map());
    netByPerson.get(r.personId)!.set(m, net);
    meta.set(r.personId, { name: r.person.name, colorHex: r.person.colorHex, order: r.person.order });
  }

  const months = [...monthSet].sort();
  const persons = [...netByPerson.keys()]
    .sort((a, b) => meta.get(a)!.order - meta.get(b)!.order || meta.get(a)!.name.localeCompare(meta.get(b)!.name))
    .map((personId) => ({
      personId,
      name: meta.get(personId)!.name,
      colorHex: meta.get(personId)!.colorHex,
      net: months.map((m) => netByPerson.get(personId)!.get(m) ?? 0),
    }));

  return { months, persons };
}

export type IncomeYearlyRow = {
  personId: string;
  name: string;
  colorHex: string;
  income: number;
  vat: number;
  pit: number;
  zus: number;
  expenses: number;
  net: number;
  months: number; // liczba miesięcy z wpisami (osobo-miesiące)
  effRate: number | null; // (VAT + PIT) / przychód
};

/** Agregaty roczne per osoba + łącznie (stopa efektywna podatku). */
export async function getIncomeYearly(
  year: number
): Promise<{ rows: IncomeYearlyRow[]; total: IncomeYearlyRow }> {
  const userId = await getCurrentUserId();
  const start = new Date(Date.UTC(year, 0, 1));
  const end = new Date(Date.UTC(year, 11, 31, 23, 59, 59));
  const records = await prisma.incomeRecord.findMany({
    where: { userId, month: { gte: start, lte: end } },
    include: { person: true, expenses: true },
  });

  const byPerson = new Map<string, IncomeYearlyRow>();
  for (const r of records) {
    const view = incomeRecordToView(r);
    const t = computeTotals(view);
    const cur =
      byPerson.get(r.personId) ??
      {
        personId: r.personId,
        name: r.person.name,
        colorHex: r.person.colorHex,
        income: 0,
        vat: 0,
        pit: 0,
        zus: 0,
        expenses: 0,
        net: 0,
        months: 0,
        effRate: null,
      };
    cur.months += 1;
    cur.income += view.income;
    cur.vat += view.vat;
    cur.pit += view.pit;
    cur.zus += view.zus;
    cur.expenses += t.totalExpenses;
    cur.net += t.net;
    byPerson.set(r.personId, cur);
  }

  const rows = [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name));
  const total: IncomeYearlyRow = {
    personId: "",
    name: "Razem",
    colorHex: "",
    income: 0,
    vat: 0,
    pit: 0,
    zus: 0,
    expenses: 0,
    net: 0,
    months: 0,
    effRate: null,
  };
  for (const r of rows) {
    total.income += r.income;
    total.vat += r.vat;
    total.pit += r.pit;
    total.zus += r.zus;
    total.expenses += r.expenses;
    total.net += r.net;
    total.months += r.months;
  }
  const eff = (r: IncomeYearlyRow) => (r.income > 0 ? (r.vat + r.pit) / r.income : null);
  rows.forEach((r) => (r.effRate = eff(r)));
  total.effRate = eff(total);
  return { rows, total };
}

// --- Średni dochód netto w wybranym zakresie ---

export type IncomeRangePreset = "3M" | "6M" | "YTD" | "1Y" | "MAX";
export const INCOME_RANGE_PRESETS: { value: IncomeRangePreset; label: string }[] = [
  { value: "3M", label: "3M" },
  { value: "6M", label: "6M" },
  { value: "YTD", label: "YTD" },
  { value: "1Y", label: "1R" },
  { value: "MAX", label: "MAX" },
];

export type IncomeAverages = {
  preset: IncomeRangePreset;
  fromMonth: string | null; // faktyczny najstarszy miesiąc z danymi
  toMonth: string | null; // faktyczny najnowszy miesiąc z danymi
  persons: {
    personId: string;
    name: string;
    colorHex: string;
    net: number;
    months: number;
    avgMonthly: number;
  }[];
  totalNet: number;
  totalMonths: number; // osobo-miesiące
  distinctMonths: number; // różne miesiące w zakresie
  avgMonthlyPerPerson: number; // totalNet / osobo-miesiące
  avgMonthlyHousehold: number; // totalNet / różne miesiące
  annualizedPerPerson: number; // avgMonthlyPerPerson × 12
};

/** Agregaty dochodu netto w zakresie miesięcznym (do KPI „średni dochód"). */
export async function getIncomeAverages(
  preset: IncomeRangePreset,
  refMonth?: string
): Promise<IncomeAverages> {
  const userId = await getCurrentUserId();
  const { from, to } = resolveMonthRange(preset, refMonth);
  const records = await prisma.incomeRecord.findMany({
    where: {
      userId,
      month: {
        gte: new Date(`${from}-01T00:00:00.000Z`),
        lte: new Date(`${to}-01T00:00:00.000Z`),
      },
    },
    include: { person: true, expenses: true },
    orderBy: { month: "asc" },
  });

  const byPerson = new Map<
    string,
    { name: string; colorHex: string; order: number; net: number; months: number }
  >();
  const monthSet = new Set<string>();
  for (const r of records) {
    monthSet.add(r.month.toISOString().slice(0, 7));
    const net = computeTotals(incomeRecordToView(r)).net;
    const cur =
      byPerson.get(r.personId) ??
      { name: r.person.name, colorHex: r.person.colorHex, order: r.person.order, net: 0, months: 0 };
    cur.net += net;
    cur.months += 1;
    byPerson.set(r.personId, cur);
  }

  const persons = [...byPerson.entries()]
    .map(([personId, v]) => ({
      personId,
      name: v.name,
      colorHex: v.colorHex,
      net: v.net,
      months: v.months,
      avgMonthly: v.months > 0 ? v.net / v.months : 0,
    }))
    .sort((a, b) => b.avgMonthly - a.avgMonthly);

  const totalNet = persons.reduce((s, p) => s + p.net, 0);
  const totalMonths = persons.reduce((s, p) => s + p.months, 0);
  const distinctMonths = monthSet.size;
  const sortedMonths = [...monthSet].sort();
  const avgMonthlyPerPerson = totalMonths > 0 ? totalNet / totalMonths : 0;

  return {
    preset,
    fromMonth: sortedMonths[0] ?? null,
    toMonth: sortedMonths.at(-1) ?? null,
    persons,
    totalNet,
    totalMonths,
    distinctMonths,
    avgMonthlyPerPerson,
    avgMonthlyHousehold: distinctMonths > 0 ? totalNet / distinctMonths : 0,
    annualizedPerPerson: avgMonthlyPerPerson * 12,
  };
}

// --- Szczegóły jednej osoby (per miesiąc) ---

export type PersonRecord = IncomeRecordView & {
  totals: ReturnType<typeof computeTotals>;
};

export type PersonDetail = {
  person: PersonView;
  records: PersonRecord[]; // od najnowszego
  netTotal: number;
  months: number;
  avgMonthly: number;
};

/** Wszystkie wpisy dochodowe jednej osoby (chronologicznie malejąco) + sumy. */
export async function getPersonDetail(personId: string): Promise<PersonDetail | null> {
  const userId = await getCurrentUserId();
  const person = await prisma.person.findFirst({
    where: { id: personId, userId },
    select: { id: true, name: true, colorHex: true, order: true },
  });
  if (!person) return null;

  const rows = await prisma.incomeRecord.findMany({
    where: { userId, personId },
    include: { expenses: true },
    orderBy: { month: "desc" },
  });
  const records: PersonRecord[] = rows.map((r) => {
    const v = incomeRecordToView(r);
    return { ...v, totals: computeTotals(v) };
  });
  const netTotal = records.reduce((s, r) => s + r.totals.net, 0);
  const months = records.length;
  return { person, records, netTotal, months, avgMonthly: months > 0 ? netTotal / months : 0 };
}
