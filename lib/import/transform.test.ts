import { describe, expect, it } from "vitest";
import {
  buildCanonicalRows,
  mapType,
  parseAmount,
  parseDate,
  summarize,
} from "./transform";
import type { Preset } from "./presets";

const preset: Preset = {
  id: "test",
  label: "test",
  hint: "",
  dateFormat: "DD.MM.YYYY",
  decimalSeparator: ",",
  thousandSeparator: " ",
  defaultCurrency: "PLN",
  columnMap: {},
};

describe("parseDate", () => {
  it("parsuje DD.MM.YYYY", () => {
    expect(parseDate("15.03.2025", "DD.MM.YYYY")).toEqual({ iso: "2025-03-15", estimated: false });
  });
  it("parsuje YYYY-MM-DD", () => {
    expect(parseDate("2025-03-15", "YYYY-MM-DD")).toEqual({ iso: "2025-03-15", estimated: false });
  });
  it("fallback: sam miesiąc+rok → ostatni dzień, estimated", () => {
    const r = parseDate("03.2025", "MM.YYYY");
    expect(r.iso).toBe("2025-03-31");
    expect(r.estimated).toBe(true);
  });
  it("nieprawidłowa data → null", () => {
    expect(parseDate("abc", "DD.MM.YYYY").iso).toBeNull();
  });
  it("niewłaściwy dzień miesiąca → null (31.02)", () => {
    expect(parseDate("31.02.2025", "DD.MM.YYYY").iso).toBeNull();
  });
});

describe("parseAmount", () => {
  it("PL: tysiące spacją, przecinek dziesiętny", () => {
    expect(parseAmount("1 234,56", ",", " ")).toBe(1234.56);
  });
  it("nawesy = ujemne", () => {
    expect(parseAmount("(100,00)", ",", " ")).toBe(-100);
  });
  it("znak minus", () => {
    expect(parseAmount("-50.25", ".", "")).toBe(-50.25);
  });
  it("DE: kropka tysiące, przecinek dziesiętny", () => {
    expect(parseAmount("12.345,67", ",", ".")).toBe(12345.67);
  });
  it("nie-liczba → null", () => {
    expect(parseAmount("abc", ",", " ")).toBeNull();
  });
});

describe("buildCanonicalRows", () => {
  it("mapuje kolumny i waliduje", () => {
    const rows = [
      { "Data operacji": "01.03.2025", "Kwota": "100,00", "Saldo": "100,00", "Waluta": "PLN", "Opis": "wpływ" },
      { "Data operacji": "xyz", "Kwota": "200,00", "Saldo": "300,00", "Waluta": "PLN", "Opis": "bad date" },
    ];
    const out = buildCanonicalRows(rows, {
      date: "Data operacji",
      amount: "Kwota",
      balance: "Saldo",
      currency: "Waluta",
      description: "Opis",
    }, preset);
    expect(out[0].date).toBe("2025-03-01");
    expect(out[0].amount).toBe(100);
    expect(out[0].balance).toBe(100);
    expect(out[0].errors).toHaveLength(0);
    expect(out[1].errors.length).toBeGreaterThan(0);
    expect(out[1].balance).toBe(300);
  });

  it("brak kolumny waluty → defaultCurrency", () => {
    const out = buildCanonicalRows([{ "Data": "01.01.2025", "Kwota": "10,00" }], { date: "Data", amount: "Kwota" }, preset);
    expect(out[0].currency).toBe("PLN");
  });
});

describe("summarize", () => {
  it("liczy błędy i ostrzeżenia", () => {
    const rows = buildCanonicalRows(
      [
        { d: "01.01.2025", a: "1,00" },
        { d: "02.01.2025", a: "x" }, // błąd kwoty
        { d: "x", a: "3,00" }, // błąd daty
      ],
      { date: "d", amount: "a" },
      preset
    );
    const s = summarize(rows);
    expect(s.total).toBe(3);
    expect(s.withErrors).toBe(2);
    expect(s.valid).toBe(1);
  });
});

describe("mapType", () => {
  it("rozpoznaje PL i EN, domyślnie BUY", () => {
    expect(mapType("KUPNO")).toBe("BUY");
    expect(mapType("Buy")).toBe("BUY");
    expect(mapType("SPRZEDAŻ")).toBe("SELL");
    expect(mapType("Sell")).toBe("SELL");
    expect(mapType("Dywidenda")).toBe("DIVIDEND");
    expect(mapType("Odsetki")).toBe("INTEREST");
    expect(mapType("Prowizja")).toBe("FEE");
    expect(mapType("")).toBe("BUY");
  });
});

describe("buildCanonicalRows — pola transakcji", () => {
  it("wyciąga type/quantity/price/amount", () => {
    const out = buildCanonicalRows(
      [{ d: "01.03.2025", t: "KUPNO", q: "100", p: "50,00", a: "5000,00" }],
      { date: "d", type: "t", quantity: "q", price: "p", amount: "a" },
      preset
    );
    expect(out[0].type).toBe("BUY");
    expect(out[0].quantity).toBe(100);
    expect(out[0].price).toBe(50);
    expect(out[0].amount).toBe(5000);
  });
});
