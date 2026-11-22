import "server-only";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";
import { hostedDatabaseUrl } from "@/lib/hosted-db";

const nodeRequire = createRequire(import.meta.url);

try {
  const { getConnectionString } = nodeRequire("@netlify/database") as typeof import("@netlify/database");
  const hostedUrl = getConnectionString();
  if (hostedUrl) process.env.DATABASE_URL = hostedUrl;
} catch (error) {
  if (hostedDatabaseUrl) process.env.DATABASE_URL = hostedDatabaseUrl;
  else console.error("hosted-db", error instanceof Error ? error.name : "unavailable");
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
