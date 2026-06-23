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
  { name: "Konto mBank", cat: "cash", base: 25000, growth: 0.02 }, // regularne oszczędności
  { name: "Poduszka finansowa ING", cat: "cash", base: 40000, growth: 0.004 },
  { name: "IKE XTB (akcje)", cat: "stocks", base: 82000, growth: 0.025 },
  { name: "Obligacje skarbowe (EDU/TOS)", cat: "bonds", base: 50000, growth: 0.008 },
  { name: "Mieszkanie", cat: "real_estate", base: 650000, growth: 0.003 },
  { name: "Bitcoin (portfel)", cat: "crypto", base: 32000, growth: 0.04, volatile: true },
];

async function main() {
  // czyszczenie (kolejność: zależne najpierw)
  await prisma.valuation.deleteMany();
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
  for (const a of assets) {
    const asset = await prisma.asset.create({
      data: {
        name: a.name,
        categoryId: catMap[a.cat],
        currency: "PLN",
        userId: user.id,
      },
    });

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

  console.log(
    `✓ Seeded: 1 user, ${categories.length} kategorii, ${assets.length} aktywów, ${totalValuations} wycen`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
