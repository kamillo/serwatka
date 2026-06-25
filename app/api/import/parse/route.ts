import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { decodeBuffer, parseCsv } from "@/lib/import/parse";
import { getPreset } from "@/lib/import/presets";

export const runtime = "nodejs"; // iconv-lite wymaga Node

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB limit

export async function POST(request: Request) {
  await getCurrentUserId(); // dev: upewnij się, że użytkownik istnieje

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "Brak pliku lub plik pusty." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Plik za duży (max ${MAX_BYTES / 1024 / 1024} MB).` },
      { status: 413 }
    );
  }

  const presetId = (form.get("preset") as string) || "generic";
  const skipRows = Number(form.get("skipRows") || 0);
  const preset = getPreset(presetId);

  const buf = Buffer.from(await file.arrayBuffer());
  const { text, detected } = decodeBuffer(buf, preset.encoding);
  const parsed = parseCsv(text, {
    delimiter: preset.delimiter,
    skipRows,
    hasHeader: preset.hasHeader ?? true,
  });

  return NextResponse.json({
    filename: file.name,
    headers: parsed.headers,
    rows: parsed.rows,
    rowCount: parsed.rows.length,
    delimiter: parsed.delimiter,
    encoding: detected,
  });
}
