// Wipe — usuwa WSZYSTKIE dane z bazy (zachowuje schemat/migracje).
// Kolejność: tabele zależne najpierw. Idempotentny.
// npx tsx scripts/wipe.ts  (lub: npm run db:wipe)
import { prisma } from "../lib/prisma";

async function main() {
  const deleted = {
    valuations: await prisma.valuation.deleteMany({}),
    transactions: await prisma.transaction.deleteMany({}),
    fxRates: await prisma.fxRate.deleteMany({}),
    macroInflation: await prisma.macroInflation.deleteMany({}),
    incomeExpenses: await prisma.incomeExpense.deleteMany({}),
    incomeRecords: await prisma.incomeRecord.deleteMany({}),
    persons: await prisma.person.deleteMany({}),
    importJobs: await prisma.importJob.deleteMany({}),
    assets: await prisma.asset.deleteMany({}),
    categories: await prisma.category.deleteMany({}),
    users: await prisma.user.deleteMany({}),
  };

  console.log("✓ Wyczyszczono wszystkie dane:");
  let total = 0;
  for (const [k, r] of Object.entries(deleted)) {
    console.log(`  ${k.padEnd(16)} ${r.count}`);
    total += r.count;
  }
  console.log(`  ${"razem".padEnd(16)} ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
