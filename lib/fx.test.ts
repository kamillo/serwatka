import { describe, expect, it } from "vitest";
import { candidateDates } from "./fx";

describe("candidateDates", () => {
  it("daty od podanej wstecz (maxBack+1 elementów)", () => {
    expect(candidateDates("2026-06-15", 3)).toEqual([
      "2026-06-15",
      "2026-06-14",
      "2026-06-13",
      "2026-06-12",
    ]);
  });
  it("default maxBack = 7", () => {
    expect(candidateDates("2026-06-15")).toHaveLength(8);
    expect(candidateDates("2026-06-15")[0]).toBe("2026-06-15");
  });
});
