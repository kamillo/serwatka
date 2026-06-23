"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import type { ActionResult } from "./assets";

export const ValuationInput = z.object({
  assetId: z.string().min(1, "Wybierz aktywo"),
  value: z.coerce.number().nonnegative("Kwota nie może być ujemna"),
  currency: z
    .string()
    .length(3, "Kod waluty: 3 litery")
    .default("PLN")
    .transform((s) => s.toUpperCase()),
  valuationDate: z.string().min(1, "Data wymagana"),
  note: z.string().max(500).optional().nullable(),
});
export type ValuationInput = z.infer<typeof ValuationInput>;

/**
 * Dodaje wycenę. Jeśli istnieje już wycena MANUAL dla tego samego aktywa + dnia —
 * aktualizuje ją (wygodne: "podaj dzisiejszą wartość" nadpisuje).
 *
 * UWAGA faza 1: wielowalutowość (FX → PLN) wchodzi w fazie 3. Tu zakładamy PLN:
 * valuePln = value, fxRateToPln = 1. Dla aktywów nie-PLN wartość zostaje zapisana
 * jako-taka (placeholder) — do poprawy wraz z modułem FX.
 */
export async function addValuation(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = ValuationInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const { assetId, value, currency, valuationDate, note } = parsed.data;

  const userId = await getCurrentUserId();
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) return { ok: false, error: "Aktywo nie istnieje" };

  const date = new Date(`${valuationDate}T00:00:00.000Z`);
  const valuePln = value; // faza 1: PLN
  const fxRateToPln = currency === "PLN" ? 1 : null;

  const existing = await prisma.valuation.findFirst({
    where: { assetId, valuationDate: date, source: "MANUAL" },
  });

  const payload = {
    valueOriginal: value,
    currency,
    fxRateToPln,
    fxRateDate: fxRateToPln !== null ? date : null,
    valuePln,
    note: note ?? null,
  };

  let valuation;
  if (existing) {
    valuation = await prisma.valuation.update({ where: { id: existing.id }, data: payload });
  } else {
    valuation = await prisma.valuation.create({
      data: { ...payload, assetId, userId, valuationDate: date, source: "MANUAL" },
    });
  }

  revalidatePath("/");
  return { ok: true, data: { id: valuation.id } };
}

export async function deleteValuation(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  await prisma.valuation.deleteMany({ where: { id, userId } });
  revalidatePath("/");
  return { ok: true, data: { id } };
}
