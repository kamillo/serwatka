import { NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/auth";
import { exportJson, exportTransactionsCsv, exportValuationsCsv } from "@/lib/export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> }
) {
  await getCurrentUserId(); // dev: tylko zalogowany user
  const { type } = await params;
  const date = new Date().toISOString().slice(0, 10);

  if (type === "json") {
    const data = await exportJson();
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="serwatka-${date}.json"`,
      },
    });
  }
  if (type === "valuations") {
    const csv = await exportValuationsCsv();
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="wyceny-${date}.csv"`,
      },
    });
  }
  if (type === "transactions") {
    const csv = await exportTransactionsCsv();
    return new Response("﻿" + csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="transakcje-${date}.csv"`,
      },
    });
  }
  return NextResponse.json({ error: "Nieznany typ eksportu" }, { status: 404 });
}
