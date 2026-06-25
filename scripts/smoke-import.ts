// Smoke test potoku importu: decode Win-1250 → PapaParse → transform → commit/undo.
// Uruchom: npx tsx scripts/smoke-import.ts
// commitImport/undoImport wołają revalidatePath (Next) — poza runtime Next rzuci
// to błąd PO zakończeniu transakcji, więc łapiemy i weryfikujemy stan DB.
import iconv from "iconv-lite";
import { decodeBuffer, parseCsv } from "../lib/import/parse";
import { buildCanonicalRows, summarize } from "../lib/import/transform";
import { getPreset } from "../lib/import/presets";
import { prisma } from "../lib/prisma";
import { commitImport, undoImport } from "../lib/actions/import";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("✗ FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("✓", msg);
  }
}

async function main() {
  // 1) potok czysty: polski CSV w Win-1250
  const csv =
    "Data operacji;Kwota;Saldo po operacji;Waluta;Opis operacji\n" +
    "2025-09-01;1000,00;1000,00;PLN;Wpływ\n" +
    "2025-09-05;-200,50;799,50;PLN;Zakupy Żabka\n" +
    "2025-09-10;1 234,56;2034,06;PLN;Przelew do Łukasza\n";
  const buf = iconv.encode(csv, "windows-1250");
  const { text, detected } = decodeBuffer(buf);
  console.log("wykryte kodowanie:", detected);
  assert(detected === "windows-1250", "detekcja windows-1250");
  assert(text.includes("Żabka") && text.includes("Łukasza"), "polskie znaki zdekodowane");

  const preset = getPreset("mbank");
  const parsed = parseCsv(text, { delimiter: preset.delimiter });
  console.log("nagłówki:", parsed.headers);
  assert(parsed.headers.includes("Data operacji"), "nagłówki sparsowane");
  assert(parsed.rows.length === 3, "3 wiersze danych");

  const colMap = {
    date: "Data operacji",
    amount: "Kwota",
    balance: "Saldo po operacji",
    currency: "Waluta",
    description: "Opis operacji",
  };
  const canon = buildCanonicalRows(parsed.rows, colMap, preset);
  console.log("kanoniczne:", canon.map((r) => ({ d: r.date, a: r.amount, b: r.balance })));
  assert(canon[0].amount === 1000, "1000,00 → 1000");
  assert(canon[1].amount === -200.5, "-200,50 → -200.5");
  assert(canon[2].amount === 1234.56, "'1 234,56' → 1234.56");
  assert(canon[2].balance === 2034.06, "saldo 2034,06 → 2034.06");
  assert(summarize(canon).valid === 3, "3 poprawne wiersze");

  // 2) round-trip commit/undo na bazie
  const user = await prisma.user.findFirst({ where: { email: "dev@networth.local" } });
  const asset = await prisma.asset.findFirst({ where: { userId: user!.id, isActive: true } });
  assert(!!asset, "seed aktywo znalezione");

  const filename = "__smoke__test.csv";
  const before = await prisma.valuation.count({
    where: { assetId: asset!.id, source: "CSV_IMPORT" },
  });

  try {
    await commitImport({
      filename,
      presetId: "mbank",
      columnMap: colMap,
      assetId: asset!.id,
      duplicatePolicy: "skip",
      rows: parsed.rows,
    });
  } catch (e) {
    console.log(
      "(oczekiwany throw revalidatePath po commicie):",
      (e as Error).message.slice(0, 70)
    );
  }

  const job = await prisma.importJob.findFirst({ where: { filename } });
  assert(!!job, "import_job utworzony");
  const vals = await prisma.valuation.count({
    where: { sourceRef: job!.id, source: "CSV_IMPORT" },
  });
  console.log("wycen z importu:", vals);
  assert(vals === 3, "3 wyceny zapisane (saldo direct, 3 daty)");

  try {
    await undoImport(job!.id);
  } catch (e) {
    console.log(
      "(oczekiwany throw revalidatePath po undo):",
      (e as Error).message.slice(0, 70)
    );
  }

  const afterJob = await prisma.importJob.findFirst({ where: { filename } });
  const afterVals = await prisma.valuation.count({
    where: { sourceRef: job!.id, source: "CSV_IMPORT" },
  });
  assert(!afterJob, "import_job usunięty po undo");
  assert(afterVals === 0, "wyceny usunięte po undo");

  const after = await prisma.valuation.count({
    where: { assetId: asset!.id, source: "CSV_IMPORT" },
  });
  assert(after === before, "stan początkowy przywrócony");

  if (process.exitCode === 1) console.error("\n⚠ Niektóre asercje nie przeszły.");
  else console.log("\n✓ Smoke test zielony.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
