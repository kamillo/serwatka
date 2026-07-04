import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Szereg miesięczny (ostatnie dni miesięcy). Brak Date.now() — deterministyczne.
const MONTHS = [
  "2025-10-31",
  "2025-11-30",
  "2025-12-31",
  "2026-01-31",
  "2026-02-28",
  "2026-03-31",
  "2026-04-30",
  "2026-05-31",
  "2026-06-15", // ostatni wpis ~połowa bieżącego miesiąca
] as const;

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const categories = [
  { slug: "cash", name: "Gotówka", colorHex: "#10b981", displayOrder: 1 },
  { slug: "stocks", name: "Akcje", colorHex: "#3b82f6", displayOrder: 2 },
  { slug: "bonds", name: "Obligacje", colorHex: "#f59e0b", displayOrder: 3 },
  { slug: "real_estate", name: "Nieruchomości", colorHex: "#8b5cf6", displayOrder: 4 },
  { slug: "crypto", name: "Krypto", colorHex: "#ef4444", displayOrder: 5 },
  { slug: "other", name: "Inne", colorHex: "#6b7280", displayOrder: 6 },
];

type SeedAsset = {
  name: string;
  cat: string;
  base: number;
  growth: number; // miesięczny
  volatile?: boolean;
};

const assets: SeedAsset[] = [
  { name: "Konto mBank", cat: "cash", base: 25000, growth: 0.02 },
  { name: "Poduszka finansowa ING", cat: "cash", base: 40000, growth: 0.004 },
  { name: "IKE XTB (akcje)", cat: "stocks", base: 82000, growth: 0.025 },
  { name: "Obligacje skarbowe (EDU/TOS)", cat: "bonds", base: 50000, growth: 0.008 },
  { name: "Mieszkanie", cat: "real_estate", base: 650000, growth: 0.003 },
  { name: "Bitcoin (portfel)", cat: "crypto", base: 32000, growth: 0.04, volatile: true },
];

// Demo transakcji dla akcji (pokazuje FIFO + real ROI na /assets/[id])
const STOCKS_TX = [
  { date: "2025-10-15", type: "BUY" as const, qty: 100, price: 200, amount: 20000, note: "Zakup ETF S&P500" },
  { date: "2025-12-10", type: "BUY" as const, qty: 50, price: 220, amount: 11000, note: "Dokupienie" },
  { date: "2026-02-20", type: "SELL" as const, qty: 40, price: 240, amount: 9600, note: "Realizacja części" },
  { date: "2026-04-05", type: "DIVIDEND" as const, qty: null, price: null, amount: 320, note: "Dywidenda" },
];

async function main() {
  // pełny wipe (kolejność: zależne najpierw) — czysta demonstracja
  await prisma.valuation.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.importJob.deleteMany();
  await prisma.fxRate.deleteMany();
  await prisma.macroInflation.deleteMany();
  await prisma.incomeExpense.deleteMany();
  await prisma.incomeRecord.deleteMany();
  await prisma.person.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.category.deleteMany();
  await prisma.user.deleteMany();

  const user = await prisma.user.create({
    data: { email: "dev@networth.local", baseCurrency: "PLN" },
  });

  const catMap: Record<string, string> = {};
  for (const c of categories) {
    const created = await prisma.category.create({ data: c });
    catMap[c.slug] = created.id;
  }

  let totalValuations = 0;
  let stocksAssetId: string | null = null;
  for (const a of assets) {
    const asset = await prisma.asset.create({
      data: {
        name: a.name,
        categoryId: catMap[a.cat],
        currency: "PLN",
        userId: user.id,
      },
    });
    if (a.cat === "stocks") stocksAssetId = asset.id;

    let value = a.base;
    const rows = MONTHS.map((iso, i) => {
      if (i > 0) {
        const noise = a.volatile ? (i % 2 === 0 ? 0.09 : -0.06) : 0;
        value = value * (1 + a.growth + noise);
      }
      const v = Math.round(value);
      return {
        assetId: asset.id,
        userId: user.id,
        valueOriginal: v,
        currency: "PLN",
        fxRateToPln: 1,
        fxRateDate: day(iso),
        valuePln: v,
        valuationDate: day(iso),
        source: "MANUAL" as const,
        note: i === 0 ? "Wartość początkowa" : "Aktualizacja miesięczna",
      };
    });
    await prisma.valuation.createMany({ data: rows });
    totalValuations += rows.length;
  }

  // transakcje demonstracyjne dla akcji
  let totalTx = 0;
  if (stocksAssetId) {
    await prisma.transaction.createMany({
      data: STOCKS_TX.map((t) => ({
        assetId: stocksAssetId!,
        userId: user.id,
        type: t.type,
        date: day(t.date),
        quantity: t.qty,
        price: t.price,
        amount: t.amount,
        currency: "PLN",
        fxRateToPln: 1,
        fxRateDate: day(t.date),
        valuePln: t.amount,
        note: t.note,
        source: "MANUAL" as const,
      })),
    });
    totalTx = STOCKS_TX.length;
  }

  // demo dochodu (2 osoby × kilka miesięcy)
  const persons = [
    { name: "Kamil", colorHex: "#10b981", order: 1 },
    { name: "Anna", colorHex: "#06b6d4", order: 2 },
  ];
  const personIds: Record<string, string> = {};
  for (const p of persons) {
    const created = await prisma.person.create({ data: { ...p, userId: user.id } });
    personIds[p.name] = created.id;
  }
  const incomeMonths = ["2026-03", "2026-04", "2026-05", "2026-06"];
  const personIncome: Record<string, { income: number; tax: number; zus: number }> = {
    Kamil: { income: 18000, tax: 3600, zus: 1634 },
    Anna: { income: 12000, tax: 2280, zus: 1634 },
  };
  let incomeRecords = 0;
  for (const name of Object.keys(personIncome)) {
    const base = personIncome[name];
    for (const m of incomeMonths) {
      const rec = await prisma.incomeRecord.create({
        data: {
          userId: user.id,
          personId: personIds[name],
          month: new Date(`${m}-01T00:00:00.000Z`),
          income: base.income,
          tax: base.tax,
          zus: base.zus,
          note: "Demo",
        },
      });
      await prisma.incomeExpense.create({
        data: { recordId: rec.id, label: "Biuro rachunkowe", amount: 300 },
      });
      incomeRecords++;
    }
  }

  console.log(
    `✓ Demo: 1 user, ${categories.length} kategorii, ${assets.length} aktywów, ${totalValuations} wycen, ${totalTx} transakcji, ${persons.length} osób, ${incomeRecords} wpisów dochodowych`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
