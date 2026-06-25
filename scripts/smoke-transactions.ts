// Smoke test trybu transakcji: import XTB-like → transakcje → ROI nominal → undo.
// npx tsx scripts/smoke-transactions.ts
import { decodeBuffer, parseCsv } from "../lib/import/parse";
import { buildCanonicalRows } from "../lib/import/transform";
import { getPreset } from "../lib/import/presets";
import { prisma } from "../lib/prisma";
import { commitImport, undoImport } from "../lib/actions/import";
import { computeNominalPerf } from "../lib/perf";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

async function main() {
  // CSV jak historia XTB (UTF-8, przecinek)
  const csv =
    "Time,Type,Volume,Open price,Amount,Currency,Comment\n" +
    "2025-10-01,Buy,100,50.00,5000.00,PLN,Akcja X\n" +
    "2025-11-01,Buy,50,52.00,2600.00,PLN,Akcja X\n" +
    "2025-12-01,Dividend,,,200.00,PLN,Dywidenda\n";
  const buf = Buffer.from(csv, "utf-8");
  const { text } = decodeBuffer(buf);
  const preset = getPreset("xtb");
  const parsed = parseCsv(text, { delimiter: preset.delimiter });
  console.log("wierszy:", parsed.rows.length);
  assert(parsed.rows.length === 3, "3 wiersze sparsowane");

  const colMap = {
    date: "Time",
    type: "Type",
    quantity: "Volume",
    price: "Open price",
    amount: "Amount",
    currency: "Currency",
    description: "Comment",
  };
  const canon = buildCanonicalRows(parsed.rows, colMap, preset);
  console.log("kanoniczne:", canon.map((r) => ({ t: r.type, q: r.quantity, p: r.price, a: r.amount })));
  assert(canon[0].type === "BUY" && canon[0].quantity === 100 && canon[0].price === 50, "BUY 100×50");
  assert(canon[2].type === "DIVIDEND" && canon[2].amount === 200, "Dividend 200");

  // aktywo stocks z seeda
  const user = await prisma.user.findFirst({ where: { email: "dev@networth.local" } });
  const asset = await prisma.asset.findFirst({
    where: { userId: user!.id, category: { slug: "stocks" } },
  });
  assert(!!asset, "seed aktywo 'stocks' znalezione");

  const filename = "__smoke__tx.csv";
  try {
    await commitImport({
      filename,
      presetId: "xtb",
      columnMap: colMap,
      assetId: asset!.id,
      duplicatePolicy: "skip",
      target: "transactions",
      rows: parsed.rows,
    });
  } catch (e) {
    console.log(
      "(oczekiwany throw revalidatePath po commicie):",
      (e as Error).message.slice(0, 60)
    );
  }

  const job = await prisma.importJob.findFirst({ where: { filename } });
  assert(!!job, "import_job utworzony");
  const txs = await prisma.transaction.findMany({
    where: { sourceRef: job!.id },
    orderBy: { date: "asc" },
  });
  console.log("transakcji z importu:", txs.length);
  assert(txs.length === 3, "3 transakcje zapisane");
  assert(txs[2].type === "DIVIDEND", "trzecia transakcja = DIVIDEND");

  // ROI nominal (currentValue = 8000)
  const perf = computeNominalPerf(
    txs.map((t) => ({ type: t.type, amount: Number(t.amount) })),
    8000
  );
  console.log("perf:", perf);
  assert(perf.invested === 7600, "wkład 7600 (5000+2600)");
  assert(perf.realizedIncome === 200, "dochód 200 (dywidenda)");
  assert(Math.abs(perf.roiPct! - 7.89) < 0.1, "ROI ≈ 7.89%");

  // undo
  try {
    await undoImport(job!.id);
  } catch (e) {
    console.log("(oczekiwany throw revalidatePath po undo):", (e as Error).message.slice(0, 60));
  }
  const after = await prisma.transaction.count({ where: { sourceRef: job!.id } });
  assert(after === 0, "transakcje usunięte po undo");
  const afterJob = await prisma.importJob.findFirst({ where: { filename } });
  assert(!afterJob, "import_job usunięty po undo");

  if (process.exitCode === 1) console.error("\n⚠ Niektóre asercje nie przeszły.");
  else console.log("\n✓ Smoke test transakcji zielony.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
