// Seed inflacji (idempotentny — nie dotyka danych użytkownika).
// npx tsx prisma/seed-inflation.ts
import { prisma } from "../lib/prisma";
import { buildCumulative } from "../lib/inflation";

async function main() {
  const points = buildCumulative();
  for (const p of points) {
    const month = new Date(`${p.month}-01T00:00:00.000Z`);
    await prisma.macroInflation.upsert({
      where: { month },
      create: {
        month,
        cpiMonthlyIndex: p.cpiMonthlyIndex,
        cumulativeIndex: p.cumulativeIndex,
        source: "GUS",
      },
      update: {
        cpiMonthlyIndex: p.cpiMonthlyIndex,
        cumulativeIndex: p.cumulativeIndex,
        source: "GUS",
      },
    });
  }
  console.log(
    `✓ Zaseedowano ${points.length} miesięcy inflacji (${points[0].month} … ${points.at(-1)!.month})`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
