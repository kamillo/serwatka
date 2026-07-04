"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { parseAmount, parseDate } from "@/lib/import/transform";
import { PERSON_COLORS } from "@/lib/income";
import type { ActionResult } from "./assets";

// --- Osoby ---

const PersonInput = z.object({
  name: z.string().trim().min(1, "Nazwa wymagana").max(80),
  colorHex: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Kolor #RRGGBB").default("#10b981"),
});
type PersonInput = z.infer<typeof PersonInput>;

export async function createPerson(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = PersonInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const userId = await getCurrentUserId();
  const last = await prisma.person.findFirst({
    where: { userId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  const person = await prisma.person.create({
    data: { ...parsed.data, userId, order: (last?.order ?? 0) + 1 },
  });
  revalidatePath("/income");
  return { ok: true, data: { id: person.id } };
}

export async function updatePerson(
  id: string,
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = PersonInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const userId = await getCurrentUserId();
  await prisma.person.update({ where: { id, userId }, data: parsed.data });
  revalidatePath("/income");
  return { ok: true, data: { id } };
}

export async function deletePerson(id: string): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  await prisma.person.delete({ where: { id, userId } }); // cascade usuwa rekordy + wydatki
  revalidatePath("/income");
  return { ok: true, data: { id } };
}

// --- Wpis dochodowy ---

const RecordInput = z.object({
  personId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/, "Miesiąc YYYY-MM"),
  income: z.coerce.number().min(0).default(0),
  tax: z.coerce.number().min(0).default(0),
  zus: z.coerce.number().min(0).default(0),
  note: z.string().max(500).optional().nullable(),
  expenses: z
    .array(z.object({ label: z.string().max(80), amount: z.coerce.number().min(0) }))
    .default([]),
});
type RecordInput = z.infer<typeof RecordInput>;

/** Upsert rekordu (osoba × miesiąc) + replace „innych wydatków". */
export async function upsertIncomeRecord(
  raw: unknown
): Promise<ActionResult<{ id: string }>> {
  const parsed = RecordInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Nieprawidłowe dane" };
  }
  const { personId, month, income, tax, zus, note, expenses } = parsed.data;

  const userId = await getCurrentUserId();
  const person = await prisma.person.findFirst({ where: { id: personId, userId } });
  if (!person) return { ok: false, error: "Osoba nie istnieje" };

  const monthDate = new Date(`${month}-01T00:00:00.000Z`);

  const record = await prisma.$transaction(async (tx) => {
    const rec = await tx.incomeRecord.upsert({
      where: { personId_month: { personId, month: monthDate } },
      create: { userId, personId, month: monthDate, income, tax, zus, note: note ?? null },
      update: { income, tax, zus, note: note ?? null },
    });
    await tx.incomeExpense.deleteMany({ where: { recordId: rec.id } });
    if (expenses.length > 0) {
      await tx.incomeExpense.createMany({
        data: expenses
          .filter((e) => e.label.trim() !== "" || e.amount > 0)
          .map((e) => ({ recordId: rec.id, label: e.label.trim() || "Wydatek", amount: e.amount })),
      });
    }
    return rec;
  });

  revalidatePath("/income");
  return { ok: true, data: { id: record.id } };
}

export async function deleteIncomeRecord(id: string): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  await prisma.incomeRecord.deleteMany({ where: { id, userId } });
  revalidatePath("/income");
  return { ok: true, data: { id } };
}

// --- Import CSV dochodu ---

const IncomeImportInput = z.object({
  rows: z.array(z.record(z.string(), z.string())),
  mapping: z.object({
    person: z.string(),
    month: z.string(),
    income: z.string().optional(),
    tax: z.string().optional(),
    zus: z.string().optional(),
    expenses: z.string().optional(),
  }),
  dateFormat: z.string().default("YYYY-MM-DD"),
  decimalSeparator: z.enum([",", "."]).default(","),
  createMissingPeople: z.boolean().default(true),
});
type IncomeImportInput = z.infer<typeof IncomeImportInput>;

export type IncomeImportSummary = {
  imported: number;
  skipped: number;
  peopleCreated: number;
  createdNames: string[];
};

/**
 * Import CSV dochodu. Każdy wiersz → rekord (osoba × miesiąc), upsert z dedup.
 * Osoby dopasowywane po nazwie (case-insensitive); brakujące tworzone (gdy createMissingPeople).
 * Wydatki (jedna kolumna) → pojedyncza linia „Inne wydatki (import)".
 */
export async function commitIncomeImport(
  raw: unknown
): Promise<ActionResult<IncomeImportSummary>> {
  const parsed = IncomeImportInput.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Nieprawidłowe dane importu dochodu." };
  }
  const { rows, mapping, dateFormat, decimalSeparator, createMissingPeople } = parsed.data;
  const userId = await getCurrentUserId();

  const existing = await prisma.person.findMany({ where: { userId } });
  const nameToId = new Map<string, string>();
  for (const p of existing) nameToId.set(p.name.toLowerCase().trim(), p.id);

  const col = (row: Record<string, string>, key: keyof IncomeImportInput["mapping"]) =>
    mapping[key] ? (row[mapping[key]!] ?? "").trim() : "";

  // utwórz brakujące osoby
  const names = [...new Set(rows.map((r) => col(r, "person")).filter(Boolean))];
  const createdNames: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (!nameToId.has(key)) {
      if (!createMissingPeople) continue;
      const p = await prisma.person.create({
        data: {
          userId,
          name,
          colorHex: PERSON_COLORS[(existing.length + createdNames.length) % PERSON_COLORS.length],
          order: existing.length + createdNames.length + 1,
        },
      });
      nameToId.set(key, p.id);
      createdNames.push(name);
    }
  }

  let imported = 0;
  let skipped = 0;
  for (const row of rows) {
    const personName = col(row, "person");
    const personId = personName ? nameToId.get(personName.toLowerCase()) : undefined;
    const { iso } = parseDate(col(row, "month"), dateFormat);
    if (!personId || !iso) {
      skipped++;
      continue;
    }
    const monthIso = iso.slice(0, 7);
    const num = (k: "income" | "tax" | "zus" | "expenses") =>
      mapping[k] ? parseAmount(col(row, k), decimalSeparator, "") ?? 0 : 0;
    const income = num("income");
    const tax = num("tax");
    const zus = num("zus");
    const expenses = num("expenses");

    const monthDate = new Date(`${monthIso}-01T00:00:00.000Z`);
    const rec = await prisma.incomeRecord.upsert({
      where: { personId_month: { personId, month: monthDate } },
      create: { userId, personId, month: monthDate, income, tax, zus },
      update: { income, tax, zus },
    });
    await prisma.incomeExpense.deleteMany({ where: { recordId: rec.id } });
    if (expenses > 0) {
      await prisma.incomeExpense.create({
        data: { recordId: rec.id, label: "Inne wydatki (import)", amount: expenses },
      });
    }
    imported++;
  }

  revalidatePath("/income");
  return { ok: true, data: { imported, skipped, peopleCreated: createdNames.length, createdNames } };
}
