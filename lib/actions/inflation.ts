"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import type { ActionResult } from "./assets";

const MonthInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "Miesiąc w formacie YYYY-MM"),
  rate: z.number(), // m/m jako ułamek (0.002 = +0.2%)
});
type MonthInput = z.infer<typeof MonthInput>;

/** Recalculates cumulativeIndex dla wszystkich miesięcy (base = najwcześniejszy = 1). */
async function recalcCumulative() {
  const all = await prisma.macroInflation.findMany({ orderBy: { month: "asc" } });
  let cum = 1;
  for (let i = 0; i < all.length; i++) {
    if (i > 0) cum *= 1 + Number(all[i].cpiMonthlyIndex);
    await prisma.macroInflation.update({
      where: { month: all[i].month },
      data: { cumulativeIndex: cum },
    });
  }
}

/** Upsert wskaźnika m/m dla miesiąca + recalc cumulative. */
export async function setInflationRate(
  raw: unknown
): Promise<ActionResult<{ month: string }>> {
  const parsed = MonthInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  await getCurrentUserId();
  const { month, rate } = parsed.data;
  const monthDate = new Date(`${month}-01T00:00:00.000Z`);

  await prisma.macroInflation.upsert({
    where: { month: monthDate },
    create: { month: monthDate, cpiMonthlyIndex: rate, cumulativeIndex: 1, source: "manual" },
    update: { cpiMonthlyIndex: rate, source: "manual" },
  });
  await recalcCumulative();

  revalidatePath("/inflation");
  revalidatePath("/");
  return { ok: true, data: { month } };
}

export async function deleteInflationMonth(
  month: string
): Promise<ActionResult<{ month: string }>> {
  await getCurrentUserId();
  const monthDate = new Date(`${month}-01T00:00:00.000Z`);
  await prisma.macroInflation.deleteMany({ where: { month: monthDate } });
  await recalcCumulative();
  revalidatePath("/inflation");
  revalidatePath("/");
  return { ok: true, data: { month } };
}
