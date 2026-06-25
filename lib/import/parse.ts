import Papa from "papaparse";
import iconv from "iconv-lite";
import type { Encoding } from "./presets";

export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
};

/** Czy bufor jest poprawnym UTF-8 (strict)? = heurystyka detekcji kodowania. */
function isValidUtf8(buf: Buffer): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(buf);
    return true;
  } catch {
    return false;
  }
}

/**
 * Dekoduje bufor z ew. polskim kodowaniem.
 * - podane encoding → wymuszone
 * - BOM UTF-8 → utf-8
 * - poprawny UTF-8 → utf-8
 * - w przeciwnym razie → windows-1250 (najczęstsze dla polskich banków)
 */
export function decodeBuffer(
  buf: Buffer,
  encoding?: Encoding
): { text: string; detected: Encoding } {
  if (encoding) return { text: iconv.decode(buf, encoding), detected: encoding };
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return { text: iconv.decode(buf.subarray(3), "utf-8"), detected: "utf-8" };
  }
  if (isValidUtf8(buf)) return { text: buf.toString("utf-8"), detected: "utf-8" };
  return { text: iconv.decode(buf, "windows-1250"), detected: "windows-1250" };
}

/**
 * Parsuje tekst CSV (PapaParse, auto-detekcja separatora).
 * - skipRows: pomija wiersze preamble (np. nagłówek mBank)
 * - transformHeader: czyści białe znaki i prefiksy "#" (mBank "#Data operacji")
 */
export function parseCsv(
  content: string,
  opts: { delimiter?: string; skipRows?: number; hasHeader?: boolean } = {}
): ParsedCsv {
  const { delimiter, skipRows = 0, hasHeader = true } = opts;

  let text = content;
  if (skipRows > 0) {
    text = text.split(/\r?\n/).slice(skipRows).join("\n");
  }

  const result = Papa.parse<Record<string, string>>(text, {
    header: hasHeader,
    delimiter: delimiter || undefined, // undefined → auto-detekcja
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().replace(/^#+\s*/, "").trim(),
  });

  const headers = (result.meta.fields ?? []) as string[];
  const rows = (result.data as Record<string, string>[]).filter((r) =>
    r && Object.values(r).some((v) => v != null && String(v).trim() !== "")
  );

  return {
    headers,
    rows,
    delimiter: result.meta.delimiter || delimiter || ",",
  };
}
