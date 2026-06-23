import { PrismaClient } from "@prisma/client";

// Singleton — zapobiega wyczerpywaniu połączeń w dev (hot reload Next tworzy
// nową instancję przy każdym przeładowaniu; trzymamy klienta w globalThis).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"] });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
