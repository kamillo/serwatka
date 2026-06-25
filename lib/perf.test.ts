import { describe, expect, it } from "vitest";
import { computeNominalPerf, realReturn } from "./perf";

describe("computeNominalPerf", () => {
  it("wkład = ΣBUY − ΣSELL, ROI z aktualnej wyceny", () => {
    const r = computeNominalPerf(
      [
        { type: "BUY", amount: 5000 },
        { type: "BUY", amount: 3000 },
        { type: "SELL", amount: 1000 },
      ],
      9000
    );
    expect(r.invested).toBe(7000); // 5000+3000-1000
    expect(r.current).toBe(9000);
    expect(r.gain).toBe(2000); // 9000-7000
    expect(r.roiPct).toBeCloseTo(28.57, 1);
  });

  it("dywidendy/odsetki doliczane do zysku", () => {
    const r = computeNominalPerf(
      [
        { type: "BUY", amount: 10000 },
        { type: "DIVIDEND", amount: 400 },
        { type: "INTEREST", amount: 100 },
      ],
      10000
    );
    expect(r.invested).toBe(10000);
    expect(r.realizedIncome).toBe(500);
    expect(r.gain).toBe(500);
    expect(r.roiPct).toBe(5);
  });

  it("opłaty (FEE) zwiększają wkład", () => {
    const r = computeNominalPerf(
      [
        { type: "BUY", amount: 1000 },
        { type: "FEE", amount: 10 },
      ],
      1000
    );
    expect(r.invested).toBe(1010);
    expect(r.gain).toBe(-10);
  });

  it("brak wkładu → roiPct null", () => {
    const r = computeNominalPerf([], 0);
    expect(r.invested).toBe(0);
    expect(r.roiPct).toBeNull();
  });
});

describe("realReturn", () => {
  it("defluje wartość aktualną skumulowaną inflacją", () => {
    // wkład 1000 (cumFrom=1.0), teraz wartość 1200, inflacja 10% (cumTo=1.1)
    const r = realReturn(1000, 1200, 1.0, 1.1)!;
    expect(r.realCurrent).toBeCloseTo(1090.91, 1); // 1200/1.1
    expect(r.realGain).toBeCloseTo(90.91, 1);
    expect(r.realRoiPct).toBeCloseTo(9.09, 1);
  });

  it("brak wkładu → null", () => {
    expect(realReturn(0, 100, 1, 1.1)).toBeNull();
  });
});
