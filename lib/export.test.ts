import { describe, expect, it } from "vitest";
import { buildIncomeCsv, type IncomeCsvRecord } from "./export";

function parseCsv(csv: string): string[][] {
  return csv.split("\r\n").map((line) => {
    const cells: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else inQ = false;
        } else cur += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") {
        cells.push(cur);
        cur = "";
      } else cur += ch;
    }
    cells.push(cur);
    return cells;
  });
}

const rec = (expenses: IncomeCsvRecord["expenses"]): IncomeCsvRecord => ({
  month: "2026-01",
  person: "Kamil",
  income: 1000,
  vat: 230,
  pit: 0,
  zus: 0,
  note: "",
  expenses,
});

describe("buildIncomeCsv", () => {
  it("każdy (typ, etykieta) wydatku/wyrównania ma osobną kolumnę", () => {
    const rows = parseCsv(
      buildIncomeCsv([
        rec([
          { label: "Biuro rachunkowe", amount: 300, type: "expense" },
          { label: "Wyrównanie", amount: -120, type: "adjustment" },
        ]),
      ])
    );
    expect(rows[0]).toEqual([
      "month", "person", "income", "vat", "pit", "zus", "expenses_total",
      "expense:Biuro rachunkowe", "adjustment:Wyrównanie", "note",
    ]);
    const data = rows[1];
    expect(data[0]).toBe("2026-01");
    expect(data[1]).toBe("Kamil");
    expect(data[6]).toBe("420"); // 300 - (-120)
    expect(data[7]).toBe("300");
    expect(data[8]).toBe("-120");
    expect(data[9]).toBe("");
  });

  it("wyrównanie dodatnie zmniejsza expenses_total", () => {
    const rows = parseCsv(
      buildIncomeCsv([
        rec([
          { label: "Biuro rachunkowe", amount: 200, type: "expense" },
          { label: "Wyrównanie", amount: 60, type: "adjustment" },
        ]),
      ])
    );
    expect(rows[1][6]).toBe("140");
  });

  it("rekord bez wydatków ma puste komórki w kolumnach dynamicznych", () => {
    const rows = parseCsv(buildIncomeCsv([rec([])]));
    expect(rows[1][6]).toBe("0");
    expect(rows[1][7]).toBe("");
  });

  it("union kolumn po wszystkich rekordach, brak danych = puste", () => {
    const rows = parseCsv(
      buildIncomeCsv([
        rec([{ label: "Biuro rachunkowe", amount: 100, type: "expense" }]),
        { ...rec([]), person: "Anna", expenses: [{ label: "Palniki", amount: 50, type: "expense" }] },
      ])
    );
    expect(rows[0]).toEqual([
      "month", "person", "income", "vat", "pit", "zus", "expenses_total",
      "expense:Biuro rachunkowe", "expense:Palniki", "note",
    ]);
    expect(rows[1][7]).toBe("100");
    expect(rows[1][8]).toBe("");
    expect(rows[2][7]).toBe("");
    expect(rows[2][8]).toBe("50");
  });

  it("duplikat (typ, etykieta) w rekordzie jest sumowany", () => {
    const rows = parseCsv(
      buildIncomeCsv([
        rec([
          { label: "Biuro rachunkowe", amount: 100, type: "expense" },
          { label: "Biuro rachunkowe", amount: 50, type: "expense" },
        ]),
      ])
    );
    expect(rows[1][7]).toBe("150");
  });

  it("kolejność kolumn: expense przed adjustment, alfabetycznie po etykiecie", () => {
    const rows = parseCsv(
      buildIncomeCsv([
        rec([
          { label: "Zus firmy", amount: 10, type: "adjustment" },
          { label: "Palniki", amount: 10, type: "expense" },
          { label: "Biuro rachunkowe", amount: 10, type: "expense" },
          { label: "Inne", amount: -5, type: "adjustment" },
        ]),
      ])
    );
    expect(rows[0].slice(7, -1)).toEqual([
      "expense:Biuro rachunkowe", "expense:Palniki",
      "adjustment:Inne", "adjustment:Zus firmy",
    ]);
  });

  it("escapuje etykietę z przecinkiem", () => {
    const csv = buildIncomeCsv([
      rec([{ label: "Biuro, rachunkowe", amount: 100, type: "expense" }]),
    ]);
    const rows = parseCsv(csv);
    expect(csv).toContain('"expense:Biuro, rachunkowe"');
    expect(rows[0][7]).toBe("expense:Biuro, rachunkowe");
    expect(rows[1][7]).toBe("100");
  });
});
