import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

const nodeRequire = createRequire(import.meta.url);

if (process.env.NETLIFY) {
  const { getConnectionString } = nodeRequire("@netlify/database") as typeof import("@netlify/database");
  process.env.DATABASE_URL = getConnectionString();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
