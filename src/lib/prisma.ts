import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const nodeRequire = createRequire(import.meta.url);

if (!process.env.DATABASE_URL) {
  try {
    const { getConnectionString } = nodeRequire("@netlify/database") as typeof import("@netlify/database");
    process.env.DATABASE_URL = getConnectionString();
  } catch {
    // Local development reads DATABASE_URL from .env when the client starts.
  }
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
