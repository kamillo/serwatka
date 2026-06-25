"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { convertToPln } from "@/lib/fx";
import type { ActionResult } from "./assets";

const TxInput = z.object({
  assetId: z.string().min(1, "Wybierz aktywo"),
  type: z.enum(["BUY", "SELL", "DIVIDEND", "INTEREST", "FEE"]).default("BUY"),
  date: z.string().min(1, "Data wymagana"),
  quantity: z.coerce.number().optional().nullable(),
  price: z.coerce.number().optional().nullable(),
  amount: z.coerce.number("Kwota wymagana"),
  note: z.string().max(500).optional().nullable(),
});
export type TxInput = z.infer<typeof TxInput>;

/** Dodaje pojedynczą transakcję do aktywa. UWAGA faza 2.5: FX w fazie 3 (valuePln = amount). */
export async function addTransaction(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = TxInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const { assetId, type, date, quantity, price, amount, note } = parsed.data;

  const userId = await getCurrentUserId();
  const asset = await prisma.asset.findFirst({ where: { id: assetId, userId } });
  if (!asset) return { ok: false, error: "Aktywo nie istnieje" };

  const dt = new Date(`${date}T00:00:00.000Z`);
  const fx = await convertToPln(amount, asset.currency, date);
  const tx = await prisma.transaction.create({
    data: {
      assetId,
      userId,
      type,
      date: dt,
      quantity: quantity ?? null,
      price: price ?? null,
      amount,
      currency: asset.currency,
      fxRateToPln: fx.fxRateToPln,
      fxRateDate: fx.fxRateDate,
      valuePln: fx.valuePln,
      note: note ?? null,
      source: "MANUAL",
    },
  });

  revalidatePath(`/assets/${assetId}`);
  revalidatePath("/");
  return { ok: true, data: { id: tx.id } };
}

export async function deleteTransaction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  const tx = await prisma.transaction.findFirst({ where: { id, userId } });
  if (!tx) return { ok: false, error: "Transakcja nie istnieje" };
  await prisma.transaction.deleteMany({ where: { id, userId } });
  revalidatePath(`/assets/${tx.assetId}`);
  revalidatePath("/");
  return { ok: true, data: { id } };
}
