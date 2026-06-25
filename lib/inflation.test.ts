import { describe, expect, it } from "vitest";
import {
  buildChartSeries,
  buildCumulative,
  cumulativeForDate,
  type RawCpi,
} from "./inflation";

// base ignoruje własny rate (cum=1); kolejne = iloczyn (1+rate) od base.
const data: RawCpi[] = [
  { month: "2024-01", rate: 0.0 }, // base → cum=1
  { month: "2024-02", rate: 0.02 }, // cum=1.02
  { month: "2024-03", rate: 0.01 }, // cum=1.02*1.01=1.0302
];

describe("buildCumulative", () => {
  it("miesiąc bazowy = 1, kolejne = iloczyn (1+rate) od base", () => {
    const p = buildCumulative(data);
    expect(p[0].cumulativeIndex).toBe(1);
    expect(p[1].cumulativeIndex).toBeCloseTo(1.02, 5);
    expect(p[2].cumulativeIndex).toBeCloseTo(1.02 * 1.01, 5);
  });
});

describe("cumulativeForDate", () => {
  it("LKV miesiąca (data w środku miesiąca → ten miesiąc)", () => {
    const p = buildCumulative(data);
    expect(cumulativeForDate(p, "2024-02-15")).toBeCloseTo(1.02, 5);
  });
  it("data przed bazą → 1", () => {
    const p = buildCumulative(data);
    expect(cumulativeForDate(p, "2023-01-01")).toBe(1);
  });
});

describe("buildChartSeries", () => {
  it("wszystkie linie zakotwiczone w pierwszej dacie; real < nominal przy inflacji", () => {
    const nominal = [
      { date: "2024-01-31", total: 1000 },
      { date: "2024-02-29", total: 1050 },
      { date: "2024-03-31", total: 1060 },
    ];
    const infl = buildCumulative(data);
    const s = buildChartSeries(nominal, infl);
    expect(s.nominal[0]).toBe(1000);
    expect(s.real[0]).toBe(1000); // zakotwiczone
    expect(s.inflationLine[0]).toBe(1000); // zakotwiczone
    expect(s.real[2]).toBeLessThan(s.nominal[2]); // inflacja > 0 → real niższy
    expect(s.inflationLine[2]).toBeGreaterThan(s.nominal[0]); // inflacja rośnie
  });
  it("pusty nominal → puste serie", () => {
    const s = buildChartSeries([], []);
    expect(s.dates).toHaveLength(0);
  });
});
