import { describe, expect, it } from "vitest";
import { aggregateByMonth, computeTotals } from "./income";

describe("computeTotals", () => {
  it("netto = przychód − VAT − PIT − ZUS − Σ wydatków", () => {
    const t = computeTotals({
      income: 20000,
      vat: 2000,
      pit: 1000,
      zus: 1600,
      expenses: [
        { label: "Biuro rachunkowe", amount: 300 },
        { label: "Telefon", amount: 100 },
      ],
    });
    expect(t.totalTax).toBe(3000); // 2000 + 1000
    expect(t.totalExpenses).toBe(400);
    expect(t.totalDeductions).toBe(5000); // 3000 + 1600 + 400
    expect(t.net).toBe(15000); // 20000 - 5000
  });

  it("stopa efektywna = (VAT + PIT) / przychód", () => {
    const t = computeTotals({ income: 20000, vat: 1500, pit: 1500, zus: 0, expenses: [] });
    expect(t.effectiveTaxRate).toBeCloseTo(0.15, 4); // 3000 / 20000
  });

  it("brak przychodu → stopa null", () => {
    expect(computeTotals({ income: 0, vat: 0, pit: 0, zus: 0, expenses: [] }).effectiveTaxRate).toBeNull();
  });

  it("wyrównanie ujemne zwiększa wydatki, dodatnie zmniejsza", () => {
    // wydatek 200, wyrównanie -300 → wydatki = 200 - (-300) = 500
    const a = computeTotals({
      income: 10000, vat: 0, pit: 0, zus: 0,
      expenses: [
        { label: "Biuro", amount: 200, type: "expense" },
        { label: "Wyrównanie", amount: -300, type: "adjustment" },
      ],
    });
    expect(a.totalExpenses).toBe(500);
    expect(a.net).toBe(9500);

    // wyrównanie dodatnie +60 zmniejsza wydatki: 200 - 60 = 140
    const b = computeTotals({
      income: 10000, vat: 0, pit: 0, zus: 0,
      expenses: [
        { label: "Biuro", amount: 200, type: "expense" },
        { label: "Wyrównanie", amount: 60, type: "adjustment" },
      ],
    });
    expect(b.totalExpenses).toBe(140);
    expect(b.net).toBe(9860);
  });
});

describe("aggregateByMonth", () => {
  it("sumuje po osobach w tym samym miesiącu, sortuje chronologicznie", () => {
    const agg = aggregateByMonth([
      { month: "2026-06", income: 10000, vat: 700, pit: 300, zus: 800, expenses: [{ label: "x", amount: 200 }] },
      { month: "2026-06", income: 8000, vat: 500, pit: 300, zus: 0, expenses: [] }, // druga osoba, ten sam miesiąc
      { month: "2026-05", income: 5000, vat: 300, pit: 200, zus: 0, expenses: [] },
    ]);
    expect(agg.map((a) => a.month)).toEqual(["2026-05", "2026-06"]);
    const jun = agg.find((a) => a.month === "2026-06")!;
    expect(jun.income).toBe(18000);
    expect(jun.vat).toBe(1200);
    expect(jun.pit).toBe(600);
    expect(jun.zus).toBe(800);
    expect(jun.expenses).toBe(200);
    expect(jun.net).toBe(18000 - 1200 - 600 - 800 - 200); // 15200
  });
});
