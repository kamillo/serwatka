"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";

const AssetInput = z.object({
  name: z.string().trim().min(1, "Nazwa wymagana").max(100),
  categoryId: z.string().optional().nullable(),
  currency: z
    .string()
    .trim()
    .length(3, "Kod waluty: 3 litery (ISO 4217)")
    .default("PLN")
    .transform((s) => s.toUpperCase()),
  isActive: z.boolean().default(true),
});
export type AssetInput = z.infer<typeof AssetInput>;

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createAsset(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = AssetInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const userId = await getCurrentUserId();
  const asset = await prisma.asset.create({
    data: { ...parsed.data, userId },
  });
  revalidatePath("/");
  return { ok: true, data: { id: asset.id } };
}

export async function updateAsset(
  id: string,
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = AssetInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const userId = await getCurrentUserId();
  const asset = await prisma.asset.update({
    where: { id, userId }, // scope per user
    data: parsed.data,
  });
  revalidatePath("/");
  return { ok: true, data: { id: asset.id } };
}

export async function deleteAsset(id: string): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  // cascade usuwa wyceny tego aktywa (zdefiniowane w schemacie)
  await prisma.asset.delete({ where: { id, userId } });
  revalidatePath("/");
  return { ok: true, data: { id } };
}

export async function toggleAssetActive(
  id: string,
  isActive: boolean
): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  await prisma.asset.update({ where: { id, userId }, data: { isActive } });
  revalidatePath("/");
  return { ok: true, data: { id } };
}
