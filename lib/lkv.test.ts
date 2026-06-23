import { describe, expect, it } from "vitest";
import {
  computeNetWorthSeries,
  pickStepDays,
  valueAtOffset,
  type ValuationPoint,
} from "./lkv";

const D = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const singleAsset: ValuationPoint[] = [
  { assetId: "a1", categorySlug: "cash", valuePln: 100, date: D("2026-01-01") },
  { assetId: "a1", categorySlug: "cash", valuePln: 150, date: D("2026-01-10") },
];

describe("computeNetWorthSeries", () => {
  it("forward-fill: wartość między wycenami = ostatnia znana", () => {
    const series = computeNetWorthSeries(singleAsset, {
      start: D("2026-01-01"),
      end: D("2026-01-12"),
    });
    // 01:100, 02-09:100, 10-12:150
    expect(series[0]).toEqual({ date: "2026-01-01", total: 100, byCategory: { cash: 100 } });
    expect(series[5].total).toBe(100); // 06.01 -> 100
    expect(series[9].total).toBe(150); // 10.01 -> 150
    expect(series[11].total).toBe(150); // 12.01 -> 150
    expect(series).toHaveLength(12);
  });

  it("aktywo z późniejszą pierwszą wyceną wpływa do sumy dopiero od niej", () => {
    const two: ValuationPoint[] = [
      ...singleAsset,
      { assetId: "a2", categorySlug: "stocks", valuePln: 500, date: D("2026-01-05") },
    ];
    const series = computeNetWorthSeries(two, {
      start: D("2026-01-01"),
      end: D("2026-01-06"),
    });
    expect(series[0].total).toBe(100); // 01.01: tylko a1
    expect(series[3].total).toBe(100); // 04.01: a2 jeszcze nie ma wyceny
    expect(series[4].total).toBe(600); // 05.01: a1=100 + a2=500
  });

  it("pusta lista wycen -> pusty szereg", () => {
    expect(computeNetWorthSeries([], { start: D("2026-01-01"), end: D("2026-01-05") })).toEqual([]);
  });

  it("start przed pierwszą wyceną -> brak wiodących zer (zaczyna od pierwszej wyceny)", () => {
    const series = computeNetWorthSeries(singleAsset, {
      start: D("2025-12-20"),
      end: D("2026-01-03"),
    });
    expect(series[0].date).toBe("2026-01-01");
    expect(series.every((p) => p.total > 0)).toBe(true);
  });

  it("grupowanie per kategoria w byCategory", () => {
    const series = computeNetWorthSeries(singleAsset, {
      start: D("2026-01-01"),
      end: D("2026-01-01"),
    });
    expect(series[0].byCategory).toEqual({ cash: 100 });
  });

  it("stepDays próbuje co N dni", () => {
    const series = computeNetWorthSeries(singleAsset, {
      start: D("2026-01-01"),
      end: D("2026-01-15"),
    }, 3);
    expect(series.map((p) => p.date)).toEqual([
      "2026-01-01", "2026-01-04", "2026-01-07", "2026-01-10", "2026-01-13",
    ]);
  });
});

describe("pickStepDays", () => {
  it("skala logarytmiczna gęstości", () => {
    expect(pickStepDays(30)).toBe(1);
    expect(pickStepDays(90)).toBe(1);
    expect(pickStepDays(180)).toBe(3);
    expect(pickStepDays(365)).toBe(3);
    expect(pickStepDays(700)).toBe(7);
    expect(pickStepDays(2000)).toBe(14);
  });
});

describe("valueAtOffset", () => {
  it("zwraca wartość N dni wstecz", () => {
    const series = computeNetWorthSeries(singleAsset, {
      start: D("2026-01-01"),
      end: D("2026-01-15"),
    });
    // 15.01: 150; ~9 dni wstecz (~06.01): 100
    const v = valueAtOffset(series, 9);
    expect(v).toBe(100);
  });

  it("pusty szereg -> null", () => {
    expect(valueAtOffset([], 7)).toBeNull();
  });
});
