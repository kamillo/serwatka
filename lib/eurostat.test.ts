import { describe, expect, it } from "vitest";
import { indicesToMonthlyRates, type HicpPoint } from "./eurostat";

describe("indicesToMonthlyRates", () => {
  it("m/m z kolejnych indeksów, pierwszy = 0", () => {
    const pts: HicpPoint[] = [
      { month: "2024-01", index: 100 },
      { month: "2024-02", index: 101 },
      { month: "2024-03", index: 100.5 },
    ];
    const r = indicesToMonthlyRates(pts);
    expect(r[0].rate).toBe(0);
    expect(r[1].rate).toBeCloseTo(0.01, 5);
    expect(r[2].rate).toBeCloseTo(-0.00495, 4);
  });
});
