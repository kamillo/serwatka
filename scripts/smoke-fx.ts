// Smoke test FX (live NBP). Daty historyczne 2024 — odporne na zegar środowiska.
// npx tsx scripts/smoke-fx.ts
import { getRateToPln, prefetchFxRange } from "../lib/fx";
import { prisma } from "../lib/prisma";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

async function main() {
  // PLN shortcut
  const pln = await getRateToPln("PLN", "2024-01-02");
  assert(pln.rate === 1, "PLN → 1");

  // USD na dzień roboczy (2024-01-02, wtorek) — realny kurs ~4.0
  const usd = await getRateToPln("USD", "2024-01-02");
  console.log("  USD 2024-01-02:", usd.rate, "(rateDate:", usd.rateDate + ")");
  assert(usd.rate > 3.5 && usd.rate < 4.5, "USD w sensownym zakresie (~4.0)");
  assert(usd.rateDate <= "2024-01-02", "rateDate ≤ data");

  // weekend → walk-back do piątku (2024-01-06 = sobota → 2024-01-05 piątek)
  const usdSat = await getRateToPln("USD", "2024-01-06");
  console.log("  USD 2024-01-06 (sobota) →", usdSat.rateDate, usdSat.rate);
  assert(usdSat.rateDate <= "2024-01-06", "weekend: rateDate ≤ sobota");
  assert(usdSat.rate > 3.5 && usdSat.rate < 4.5, "weekend: kurs sensowny");

  // cache hit (drugie wywołanie tej samej daty)
  const usdAgain = await getRateToPln("USD", "2024-01-02");
  assert(Math.abs(usdAgain.rate - usd.rate) < 1e-9, "cache hit: ta sama wartość");

  // prefetch zakresu EUR
  await prefetchFxRange("EUR", "2024-01-02", "2024-02-29");
  const eurCached = await prisma.fxRate.count({
    where: { currency: "EUR", source: "NBP", rateDate: { gte: new Date("2024-01-02T00:00:00.000Z"), lte: new Date("2024-02-29T00:00:00.000Z") } },
  });
  console.log("  EUR w cache (styczeń-luty 2024):", eurCached);
  assert(eurCached > 5, "prefetch EUR zcacheował >5 dni");

  const eur = await getRateToPln("EUR", "2024-01-15");
  console.log("  EUR 2024-01-15:", eur.rate, "(rateDate:", eur.rateDate + ")");
  assert(eur.rate > 4.0 && eur.rate < 4.8, "EUR w sensownym zakresie (~4.3)");

  if (process.exitCode === 1) console.error("\n⚠ Niektóre asercje nie przeszły.");
  else console.log("\n✓ Smoke test FX zielony (NBP live).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
