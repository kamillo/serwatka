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
  vat: z.coerce.number().min(0).default(0),
  pit: z.coerce.number().min(0).default(0),
  zus: z.coerce.number().min(0).default(0),
  note: z.string().max(500).optional().nullable(),
  expenses: z
    .array(z.object({ label: z.string().max(80), amount: z.coerce.number(), type: z.enum(["expense", "adjustment"]).default("expense") }))
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
  const { personId, month, income, vat, pit, zus, note, expenses } = parsed.data;

  const userId = await getCurrentUserId();
  const person = await prisma.person.findFirst({ where: { id: personId, userId } });
  if (!person) return { ok: false, error: "Osoba nie istnieje" };

  const monthDate = new Date(`${month}-01T00:00:00.000Z`);

  const record = await prisma.$transaction(async (tx) => {
    const rec = await tx.incomeRecord.upsert({
      where: { personId_month: { personId, month: monthDate } },
      create: { userId, personId, month: monthDate, income, vat, pit, zus, note: note ?? null },
      update: { income, vat, pit, zus, note: note ?? null },
    });
    await tx.incomeExpense.deleteMany({ where: { recordId: rec.id } });
    if (expenses.length > 0) {
      await tx.incomeExpense.createMany({
        data: expenses
          .filter((e) => e.label.trim() !== "" || e.amount !== 0)
          .map((e) => ({ recordId: rec.id, label: e.label.trim() || "Wydatek", amount: e.amount, type: e.type })),
      });
    }
    return rec;
  });

  revalidatePath("/income");
  revalidatePath("/income/[personId]", "page");
  return { ok: true, data: { id: record.id } };
}

export async function deleteIncomeRecord(id: string): Promise<ActionResult<{ id: string }>> {
  const userId = await getCurrentUserId();
  await prisma.incomeRecord.deleteMany({ where: { id, userId } });
  revalidatePath("/income");
  revalidatePath("/income/[personId]", "page");
  return { ok: true, data: { id } };
}

// --- Import CSV dochodu ---

const IncomeImportInput = z.object({
  rows: z.array(z.record(z.string(), z.string())),
  mapping: z.object({
    person: z.string().optional(), // kolumna z nazwą osoby (opcjonalna)
    personManual: z.string().optional(), // nazwa wpisana ręcznie (gdy brak kolumny / pusty wiersz)
    month: z.string(),
    income: z.string().optional(),
    vat: z.string().optional(), // kolumna z podatkiem VAT
    pit: z.string().optional(), // kolumna z podatkiem dochodowym PIT
    zus: z.string().optional(),
    expenseColumns: z
      .array(
        z.object({
          column: z.string(),
          label: z.string().max(80),
          type: z.enum(["expense", "adjustment"]),
        })
      )
      .default([]),
  }),
  dateFormat: z.string().default("YYYY-MM-DD"),
  decimalSeparator: z.enum([",", "."]).default(","),
  createMissingPeople: z.boolean().default(true),
});

export type IncomeImportSummary = {
  imported: number;
  skipped: number;
  peopleCreated: number;
  createdNames: string[];
};

/**
 * Import CSV dochodu. Każdy wiersz → rekord (osoba × miesiąc), upsert z dedup.
 * Osoba: wartość z kolumny `person`; gdy pusta/brak kolumny → fallback do `personManual`.
 * Brakujące osoby tworzone (gdy createMissingPeople), dopasowanie po nazwie (case-insensitive).
 * Wydatki: każda kolumna z `expenseColumns` staje się osobną linią.
 *   - type="expense"     → wartość zawsze dodatnia (abs).
 *   - type="adjustment"  → wyrównanie, wartość ze znakiem (może być ujemna → korekta netto).
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

  const col = (
    row: Record<string, string>,
    key: "person" | "month" | "income" | "vat" | "pit" | "zus"
  ) => (mapping[key] ? (row[mapping[key]!] ?? "").trim() : "");

  const personManual = (mapping.personManual ?? "").trim();
  const resolvePerson = (row: Record<string, string>) => {
    const v = col(row, "person");
    return v || personManual;
  };

  // utwórz brakujące osoby + wstaw rekordy w jednej transakcji (atomowo, szybciej)
  const result = await prisma.$transaction(
    async (tx) => {
      const names = [...new Set(rows.map(resolvePerson).filter(Boolean))];
      const createdNames: string[] = [];
      for (const name of names) {
        const key = name.toLowerCase();
        if (!nameToId.has(key)) {
          if (!createMissingPeople) continue;
          const p = await tx.person.create({
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
        const personName = resolvePerson(row);
        const personId = personName ? nameToId.get(personName.toLowerCase()) : undefined;
        const { iso } = parseDate(col(row, "month"), dateFormat);
        if (!personId || !iso) {
          skipped++;
          continue;
        }
        const monthIso = iso.slice(0, 7);
        const num = (k: "income" | "vat" | "pit" | "zus") =>
          mapping[k] ? parseAmount(col(row, k), decimalSeparator, "") ?? 0 : 0;
        const income = num("income");
        const vat = num("vat");
        const pit = num("pit");
        const zus = num("zus");

        // linie wydatków / wyrównań z wielu kolumn
        const lines: { label: string; amount: number; type: "expense" | "adjustment" }[] = [];
        for (const ec of mapping.expenseColumns) {
          const rawVal = (row[ec.column] ?? "").trim();
          if (!rawVal) continue;
          const parsedAmount = parseAmount(rawVal, decimalSeparator, "");
          if (parsedAmount == null || parsedAmount === 0) continue;
          const label = (ec.label ?? "").trim() || ec.column;
          const amount = ec.type === "expense" ? Math.abs(parsedAmount) : parsedAmount;
          lines.push({ label, amount, type: ec.type });
        }

        const monthDate = new Date(`${monthIso}-01T00:00:00.000Z`);
        const rec = await tx.incomeRecord.upsert({
          where: { personId_month: { personId, month: monthDate } },
          create: { userId, personId, month: monthDate, income, vat, pit, zus },
          update: { income, vat, pit, zus },
        });
        await tx.incomeExpense.deleteMany({ where: { recordId: rec.id } });
        if (lines.length > 0) {
          await tx.incomeExpense.createMany({
            data: lines.map((l) => ({ recordId: rec.id, label: l.label, amount: l.amount, type: l.type })),
          });
        }
        imported++;
      }
      return { imported, skipped, peopleCreated: createdNames.length, createdNames };
    },
    { timeout: 120000, maxWait: 10000 }
  );

  revalidatePath("/income");
  return { ok: true, data: result };
}
