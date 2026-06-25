"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { getPreset, type FieldKey } from "@/lib/import/presets";
import { buildCanonicalRows, type TxType } from "@/lib/import/transform";
import { convertToPln, prefetchFxRange } from "@/lib/fx";
import type { ActionResult } from "./assets";

/** Prefetch kursów dla walut nie-PLN w zakresie dat wierszy (cache pod import). */
async function prefetchRowsFx(rows: { currency: string; date: string | null }[]) {
  const nonPln = [...new Set(rows.map((r) => r.currency).filter((c) => c && c !== "PLN"))];
  if (nonPln.length === 0) return;
  const ds = rows.map((r) => r.date).filter((d): d is string => !!d).sort();
  if (ds.length === 0) return;
  for (const c of nonPln) await prefetchFxRange(c, ds[0], ds[ds.length - 1]);
}

const CommitInput = z.object({
  filename: z.string().min(1),
  presetId: z.string(),
  columnMap: z.record(z.string(), z.string()),
  assetId: z.string().min(1),
  duplicatePolicy: z.enum(["skip", "overwrite"]),
  target: z.enum(["valuations", "transactions"]).default("valuations"),
  rows: z.array(z.record(z.string(), z.string())),
});
export type CommitInput = z.infer<typeof CommitInput>;

export type CommitSummary = {
  jobId: string;
  imported: number;
  skipped: number; // invalidne + pominięte duplikaty
  duplicates: number; // łącznie znalezionych dat-duplikatów
  invalid: number; // wiersze z błędami
  mode: "balance" | "running" | "transactions";
};

/**
 * Konwertuje wiersze CSV na wyceny i zapisuje (transakcyjnie).
 * - saldo (balance) zamapowane → bezpośredni snapshot per data (ostatnie saldo dnia).
 * - tylko kwota (amount) → running balance (skumulowana suma zmian).
 * - duplikaty (data+aktywo już w bazie): skip | overwrite.
 * UWAGA faza 1/2: wielowalutowość (FX→PLN) w fazie 3; tu valuePln = value.
 */
export async function commitImport(raw: unknown): Promise<ActionResult<CommitSummary>> {
  const parsed = CommitInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe dane wejściowe importu." };
  }
  const { filename, presetId, columnMap, assetId, duplicatePolicy, target, rows } =
    parsed.data;

  const userId = await getCurrentUserId();
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) return { ok: false, error: "Aktywo nie istnieje." };

  const preset = getPreset(presetId);
  const canonical = buildCanonicalRows(
    rows,
    columnMap as Partial<Record<FieldKey, string>>,
    preset
  );
  const valid = canonical.filter((r) => r.errors.length === 0 && r.date);
  const invalid = canonical.length - valid.length;

  // --- Tryb transakcji: każdy wiersz → transakcja (append, bez dedup) ---
  if (target === "transactions") {
    const txRows = valid.filter((r) => r.amount != null);
    const noAmount = valid.length - txRows.length;
    const rowsTotal = canonical.length;

    await prefetchRowsFx(txRows);

    const txData: Array<{
      assetId: string; userId: string; type: TxType; date: Date;
      quantity: number | null; price: number | null; amount: number; currency: string;
      fxRateToPln: number; fxRateDate: Date; valuePln: number;
      note: string | null; source: "CSV_IMPORT";
    }> = [];
    for (const r of txRows) {
      const fx = await convertToPln(r.amount!, r.currency, r.date!);
      txData.push({
        assetId,
        userId,
        type: r.type,
        date: new Date(`${r.date!}T00:00:00.000Z`),
        quantity: r.quantity,
        price: r.price,
        amount: r.amount!,
        currency: r.currency,
        fxRateToPln: fx.fxRateToPln,
        fxRateDate: fx.fxRateDate,
        valuePln: fx.valuePln,
        note: r.description || null,
        source: "CSV_IMPORT",
      });
    }

    const job = await prisma.$transaction(async (tx) => {
      const job = await tx.importJob.create({
        data: {
          userId,
          filename,
          sourceType: presetId,
          mappingConfig: { ...preset, presetId, columnMap, target } as object,
          status: "committed",
          rowsTotal,
          rowsImported: 0,
          rowsSkipped: 0,
        },
      });
      if (txData.length > 0) {
        await tx.transaction.createMany({
          data: txData.map((d) => ({ ...d, sourceRef: job.id })),
        });
      }
      await tx.importJob.update({
        where: { id: job.id },
        data: { rowsImported: txData.length, rowsSkipped: invalid + noAmount },
      });
      return job;
    });

    revalidatePath("/");
    revalidatePath("/import");
    return {
      ok: true,
      data: {
        jobId: job.id,
        imported: txData.length,
        skipped: invalid + noAmount,
        duplicates: 0,
        invalid: invalid + noAmount,
        mode: "transactions",
      },
    };
  }

  const useBalance = Boolean(columnMap.balance);
  const mode: "balance" | "running" = useBalance ? "balance" : "running";

  // Agregacja per data (chronologicznie).
  const sorted = [...valid].sort((a, b) => (a.date! < b.date! ? -1 : a.date! > b.date! ? 1 : 0));
  const byDate = new Map<string, { value: number; currency: string; description: string }>();

  if (useBalance) {
    for (const r of sorted) {
      if (r.balance == null) continue;
      byDate.set(r.date!, {
        value: r.balance,
        currency: r.currency,
        description: r.description,
      }); // ostatnie saldo dnia wygrywa
    }
  } else {
    let running = 0;
    for (const r of sorted) {
      if (r.amount == null) continue;
      running += r.amount;
      byDate.set(r.date!, {
        value: running,
        currency: r.currency,
        description: r.description,
      });
    }
  }

  const dateKeys = [...byDate.keys()];
  const dates = dateKeys.map((d) => new Date(`${d}T00:00:00.000Z`));

  // Istniejące wyceny dla tych dat (detekcja duplikatów przed zapisem).
  const existing = await prisma.valuation.findMany({
    where: { assetId, userId, valuationDate: { in: dates } },
    select: { valuationDate: true },
  });
  const existingDates = new Set(
    existing.map((e) => e.valuationDate.toISOString().slice(0, 10))
  );

  const overwriteDates: Date[] = [];
  let imported = 0;
  let duplicates = 0;
  let dupSkipped = 0;

  const keptKeys = dateKeys.filter((dateKey) => {
    const isDup = existingDates.has(dateKey);
    if (isDup) {
      duplicates++;
      if (duplicatePolicy === "skip") {
        dupSkipped++;
        return false;
      }
      overwriteDates.push(new Date(`${dateKey}T00:00:00.000Z`));
    }
    return true;
  });

  await prefetchRowsFx(
    keptKeys.map((k) => ({ currency: byDate.get(k)!.currency, date: k }))
  );

  const toInsert: Array<{
    assetId: string;
    userId: string;
    valueOriginal: number;
    currency: string;
    fxRateToPln: number;
    fxRateDate: Date;
    valuePln: number;
    valuationDate: Date;
    source: "CSV_IMPORT";
    note: string | null;
  }> = [];
  for (const dateKey of keptKeys) {
    const v = byDate.get(dateKey)!;
    const fx = await convertToPln(v.value, v.currency, dateKey);
    imported++;
    toInsert.push({
      assetId,
      userId,
      valueOriginal: v.value,
      currency: v.currency,
      fxRateToPln: fx.fxRateToPln,
      fxRateDate: fx.fxRateDate,
      valuePln: fx.valuePln,
      valuationDate: new Date(`${dateKey}T00:00:00.000Z`),
      source: "CSV_IMPORT" as const,
      note: v.description || null,
    });
  }

  const rowsTotal = canonical.length;

  // Transakcja: job → usunięcie overwrite → wyceny → liczniki.
  const job = await prisma.$transaction(async (tx) => {
    const job = await tx.importJob.create({
      data: {
        userId,
        filename,
        sourceType: presetId,
        mappingConfig: { ...preset, presetId, columnMap } as object,
        status: "committed",
        rowsTotal,
        rowsImported: 0,
        rowsSkipped: 0,
      },
    });

    if (overwriteDates.length > 0) {
      await tx.valuation.deleteMany({
        where: { assetId, userId, valuationDate: { in: overwriteDates } },
      });
    }

    if (toInsert.length > 0) {
      await tx.valuation.createMany({
        data: toInsert.map((v) => ({ ...v, sourceRef: job.id })),
      });
    }

    await tx.importJob.update({
      where: { id: job.id },
      data: { rowsImported: imported, rowsSkipped: invalid + dupSkipped },
    });

    return job;
  });

  revalidatePath("/");
  revalidatePath("/import");

  return {
    ok: true,
    data: {
      jobId: job.id,
      imported,
      skipped: invalid + dupSkipped,
      duplicates,
      invalid,
      mode,
    },
  };
}

export type ImportJobView = {
  id: string;
  filename: string;
  sourceType: string;
  rowsTotal: number;
  rowsImported: number;
  rowsSkipped: number;
  createdAt: Date;
};

export async function getImportHistory(): Promise<ImportJobView[]> {
  const userId = await getCurrentUserId();
  return prisma.importJob.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/** Cofnięcie importu: usuwa wyceny utworzone przez ten import + samo zadanie. */
export async function undoImport(
  jobId: string
): Promise<ActionResult<{ id: string; deleted: number }>> {
  const userId = await getCurrentUserId();
  const job = await prisma.importJob.findFirst({ where: { id: jobId, userId } });
  if (!job) return { ok: false, error: "Import nie istnieje." };

  const result = await prisma.$transaction(async (tx) => {
    const delVal = await tx.valuation.deleteMany({
      where: { sourceRef: jobId, source: "CSV_IMPORT", userId },
    });
    const delTx = await tx.transaction.deleteMany({
      where: { sourceRef: jobId, source: "CSV_IMPORT", userId },
    });
    await tx.importJob.delete({ where: { id: jobId } });
    return delVal.count + delTx.count;
  });

  revalidatePath("/");
  revalidatePath("/import");
  return { ok: true, data: { id: jobId, deleted: result } };
}
