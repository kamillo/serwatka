// Smoke test importu dochodu: VAT + PIT, wiele kolumn wydatków, wyrównania (±), ręczna osoba.
// Uruchom: npx tsx scripts/smoke-income-import.ts
// commitIncomeImport woła revalidatePath (Next) — poza runtime Next rzuci to błąd
// PO zakończeniu transakcji, więc łapiemy i weryfikujemy stan DB.
import { prisma } from "../lib/prisma";
import { commitIncomeImport } from "../lib/actions/income";

function assert(cond: unknown, msg: string) {
  if (cond) {
    console.log("✓", msg);
  } else {
    console.error("✗ FAIL:", msg);
    process.exitCode = 1;
  }
}

/** revalidatePath zgłoszone PO zapisach → traktujemy jako sukces (stan weryfikujemy w DB). */
function handleRevalidate(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes("revalidate")
    ? { ok: true, data: null }
    : { ok: false, error: msg };
}

async function main() {
  const user = await prisma.user.findFirst({ where: { email: "dev@networth.local" } });
  if (!user) throw new Error("Brak użytkownika dev@networth.local — uruchom `npm run db:demo`.");

  const month = "2025-07";

  // --- Scenariusz 1: brak kolumny "osoba" + VAT/PIT + wiele kolumn wydatków + wyrównanie (±) ---
  const rows = [
    { Miesiąc: month, Przychód: "10 000,00", VAT: "2 000,00", PIT: "1 200,00", ZUS: "400,00", "Biuro rachunkowe": "250,00", "Wyrównanie VAT": "-150,00" },
    { Miesiąc: month, Przychód: "8 000,00", VAT: "1 600,00", PIT: "960,00", ZUS: "400,00", "Biuro rachunkowe": "0,00", "Wyrównanie VAT": "60,00" },
  ];

  const res1 = await commitIncomeImport({
    rows,
    mapping: {
      person: "",
      personManual: "Anna Testowa",
      month: "Miesiąc",
      income: "Przychód",
      vat: "VAT",
      pit: "PIT",
      zus: "ZUS",
      expenseColumns: [
        { column: "Biuro rachunkowe", label: "Biuro rachunkowe", type: "expense" },
        { column: "Wyrównanie VAT", label: "Wyrównanie VAT", type: "adjustment" },
      ],
    },
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ",",
    createMissingPeople: true,
  }).catch(handleRevalidate);

  assert(res1?.ok, "import #1: sukces (ręczna osoba, VAT/PIT, 2 kolumny wydatków, wyrównanie ±)");

  const anna = await prisma.person.findFirst({ where: { userId: user.id, name: "Anna Testowa" } });
  assert(!!anna, "osoba Anna Testowa utworzona z personManual");

  if (anna) {
    // upsert po personId+month → tylko JEDEN rekord (drugi wiersz nadpisał pierwszy)
    const recs = await prisma.incomeRecord.findMany({
      where: { personId: anna.id, month: new Date(`${month}-01T00:00:00.000Z`) },
      include: { expenses: true },
    });
    assert(recs.length === 1, "dokładnie 1 rekord (osoba×miesiąc) po dedup");
    const r = recs[0];
    assert(Number(r.income) === 8000, "ostatni wiersz wygrywa: income 8000");
    assert(Number(r.vat) === 1600, "vat 1600 z 2. wiersza");
    assert(Number(r.pit) === 960, "pit 960 z 2. wiersza");
    const byLabel = new Map(r.expenses.map((e) => [e.label, Number(e.amount)]));
    const byType = new Map(r.expenses.map((e) => [e.label, e.type]));
    assert(!byLabel.has("Biuro rachunkowe"), "wydatek=0 z 2. wiersza pominięty (brak linii)");
    const wyr = byLabel.get("Wyrównanie VAT");
    assert(wyr === 60, `wyrównanie dodatnie zapisane = +60 (otrzymano ${wyr})`);
    assert(byType.get("Wyrównanie VAT") === "adjustment", "linia oznaczona type=adjustment");

    // wydatki = Σ wydatków − Σ wyrównań = 0 − 60 = −60 (dodatnie wyrównanie ZMNIEJSZA wydatki)
    // netto = 8000 - 1600(vat) - 960(pit) - 400(zus) - (-60) = 5100
    const expSum = r.expenses.reduce((s, e) => s + (e.type === "adjustment" ? -Number(e.amount) : Number(e.amount)), 0);
    assert(expSum === -60, `suma wydatków z wyrównaniem = -60 (otrzymano ${expSum})`);
    const net = Number(r.income) - Number(r.vat) - Number(r.pit) - Number(r.zus) - expSum;
    assert(net === 5100, `netto = 5100 — dodatnie wyrównanie zwiększa netto (otrzymano ${net})`);
  }

  // --- Scenariusz 2: wyrównanie UJEMNE zwiększa wydatki (zmniejsza netto) ---
  await prisma.person.deleteMany({ where: { userId: user.id, name: "Anna Testowa" } }).catch(() => {});

  const res2 = await commitIncomeImport({
    rows: [{ Miesiąc: month, Przychód: "5000,00", PIT: "500,00", ZUS: "0,00", Korekta: "-300,00" }],
    mapping: {
      person: "",
      personManual: "Korektor",
      month: "Miesiąc",
      income: "Przychód",
      vat: "",
      pit: "PIT",
      zus: "ZUS",
      expenseColumns: [{ column: "Korekta", label: "Korekta", type: "adjustment" }],
    },
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ",",
    createMissingPeople: true,
  }).catch(handleRevalidate);

  assert(res2?.ok, "import #2: sukces (wyrównanie ujemne, tylko PIT)");

  const kor = await prisma.person.findFirst({ where: { userId: user.id, name: "Korektor" } });
  if (kor) {
    const r = await prisma.incomeRecord.findFirst({
      where: { personId: kor.id, month: new Date(`${month}-01T00:00:00.000Z`) },
      include: { expenses: true },
    });
    if (r) {
      assert(Number(r.vat) === 0, "vat niezmapowane → 0");
      assert(Number(r.pit) === 500, "pit 500");
      const wyr = Number(r.expenses[0]?.amount);
      assert(wyr === -300, `wyrównanie ujemne zachowane = -300 (otrzymano ${wyr})`);
      assert(r.expenses[0]?.type === "adjustment", "linia oznaczona type=adjustment");
      // suma wydatków = −wyr = −(−300) = +300 (ujemne wyrównanie ZWIĘKSZA wydatki)
      const expSum = r.expenses.reduce((s, e) => s + (e.type === "adjustment" ? -Number(e.amount) : Number(e.amount)), 0);
      assert(expSum === 300, `suma wydatków = 300 (otrzymano ${expSum})`);
      const net = Number(r.income) - Number(r.vat) - Number(r.pit) - Number(r.zus) - expSum;
      assert(net === 4200, `netto z ujemnym wyrównaniem = 4200 (−300 zwiększa wydatki) (otrzymano ${net})`);
    }
  }

  // --- Scenariusz 3: createMissingPeople=false pomija nieznaną osobę ---
  const res3 = await commitIncomeImport({
    rows: [{ Osoba: "Nieznana", Miesiąc: month, Przychód: "100,00" }],
    mapping: {
      person: "Osoba",
      personManual: "",
      month: "Miesiąc",
      income: "Przychód",
      vat: "",
      pit: "",
      zus: "",
      expenseColumns: [],
    },
    dateFormat: "YYYY-MM-DD",
    decimalSeparator: ",",
    createMissingPeople: false,
  }).catch(handleRevalidate);

  assert(res3?.ok, "import #3: brak błędu");
  const nieznana = await prisma.person.findFirst({ where: { userId: user.id, name: "Nieznana" } });
  assert(!nieznana, "osoba Nieznana NIE utworzona (createMissing=false)");

  // sprzątanie
  await prisma.person
    .deleteMany({ where: { userId: user.id, name: { in: ["Korektor", "Anna Testowa", "Nieznana"] } } })
    .catch(() => {});

  console.log("\nGotowe.");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
