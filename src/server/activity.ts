import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type Db = Prisma.TransactionClient | typeof prisma;

export async function nextDocumentNumber(db: Db, key: string, prefix: string) {
  const seq = await db.documentSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  return `${prefix}-${new Date().getFullYear()}-${String(seq.value).padStart(5, "0")}`;
}

export async function writeAudit(
  db: Db,
  input: { userId?: string | null; action: string; entity: string; entityId?: string | null; details?: Prisma.InputJsonValue },
) {
  await db.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      details: input.details,
    },
  });
}

export async function notify(
  db: Db,
  input: {
    type: "LOW_STOCK" | "OUT_OF_STOCK" | "NEW_PURCHASE" | "NEW_SALE" | "STOCK_ADJUSTMENT" | "SYSTEM";
    title: string;
    message: string;
    link?: string | null;
    userId?: string | null;
  },
) {
  await db.notification.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      userId: input.userId ?? null,
    },
  });
}
