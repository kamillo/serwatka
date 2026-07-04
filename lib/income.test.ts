import { describe, expect, it } from "vitest";
import { aggregateByMonth, computeTotals } from "./income";

describe("computeTotals", () => {
  it("netto = przychód − podatek − ZUS − Σ wydatków", () => {
    const t = computeTotals({
      income: 20000,
      tax: 3000,
      zus: 1600,
      expenses: [
        { label: "Biuro rachunkowe", amount: 300 },
        { label: "Telefon", amount: 100 },
      ],
    });
    expect(t.totalExpenses).toBe(400);
    expect(t.totalDeductions).toBe(5000); // 3000+1600+400
    expect(t.net).toBe(15000); // 20000-5000
  });

  it("stopa efektywna = podatek/przychód", () => {
    const t = computeTotals({ income: 20000, tax: 3000, zus: 0, expenses: [] });
    expect(t.effectiveTaxRate).toBeCloseTo(0.15, 4);
  });

  it("brak przychodu → stopa null", () => {
    expect(computeTotals({ income: 0, tax: 0, zus: 0, expenses: [] }).effectiveTaxRate).toBeNull();
  });
});

describe("aggregateByMonth", () => {
  it("sumuje po osobach w tym samym miesiącu, sortuje chronologicznie", () => {
    const agg = aggregateByMonth([
      { month: "2026-06", income: 10000, tax: 1000, zus: 800, expenses: [{ label: "x", amount: 200 }] },
      { month: "2026-06", income: 8000, tax: 800, zus: 0, expenses: [] }, // druga osoba, ten sam miesiąc
      { month: "2026-05", income: 5000, tax: 500, zus: 0, expenses: [] },
    ]);
    expect(agg.map((a) => a.month)).toEqual(["2026-05", "2026-06"]);
    const jun = agg.find((a) => a.month === "2026-06")!;
    expect(jun.income).toBe(18000);
    expect(jun.tax).toBe(1800);
    expect(jun.zus).toBe(800);
    expect(jun.expenses).toBe(200);
    expect(jun.net).toBe(18000 - 1800 - 800 - 200); // 15200
  });
});
