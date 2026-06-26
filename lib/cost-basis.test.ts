import { describe, expect, it } from "vitest";
import { computeFifoPerf } from "./cost-basis";

describe("computeFifoPerf", () => {
  it("FIFO: zrealizowany + niezrealizowany P&L", () => {
    // BUY 100@50 (5000), BUY 50@60 (3000), SELL 120 za 7000, pozostało 30 szt warte 2100
    const r = computeFifoPerf(
      [
        { type: "BUY", quantity: 100, price: 50, amount: 5000 },
        { type: "BUY", quantity: 50, price: 60, amount: 3000 },
        { type: "SELL", quantity: 120, price: null, amount: 7000 },
      ],
      2100
    )!;
    // SELL 120: 100@50 (5000) + 20@60 (1200) = koszt 6200 → realized 800
    expect(r.realizedGain).toBe(800);
    // pozostał lot 30@60 = basis 1800 → unrealized 2100-1800 = 300
    expect(r.remainingQty).toBe(30);
    expect(r.remainingBasis).toBe(1800);
    expect(r.unrealizedGain).toBe(300);
    expect(r.totalGain).toBe(1100); // 800+300
    expect(r.totalInvested).toBe(8000);
    expect(r.roiPct).toBeCloseTo(13.75, 2);
  });

  it("dywidendy doliczane do income", () => {
    const r = computeFifoPerf(
      [
        { type: "BUY", quantity: 10, price: 100, amount: 1000 },
        { type: "DIVIDEND", quantity: null, price: null, amount: 50 },
      ],
      1000
    )!;
    expect(r.income).toBe(50);
    expect(r.totalGain).toBe(50);
  });

  it("brak ilości → null (FIFO bez sensu)", () => {
    expect(
      computeFifoPerf(
        [{ type: "BUY", quantity: null, price: null, amount: 1000 }],
        1100
      )
    ).toBeNull();
  });

  it("cena jednostkowa liczona z amount/qty gdy brak price", () => {
    const r = computeFifoPerf(
      [{ type: "BUY", quantity: 100, price: null, amount: 5000 }],
      6000
    )!;
    expect(r.remainingBasis).toBe(5000); // 100 * (5000/100)
    expect(r.unrealizedGain).toBe(1000);
  });
});
