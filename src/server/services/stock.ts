import { Prisma, StockTransactionType } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import type { StockInput } from "@/lib/validators";
import { nextDocumentNumber, writeAudit } from "@/server/activity";
import { assertPermission, getSettings } from "@/server/guard";
import { applyStockChange } from "@/server/stock";

const ABSOLUTE = new Set<StockTransactionType>(["ADJUSTMENT", "OPENING"]);

export async function recordStockMovement(input: StockInput) {
  const user = await assertPermission(PERMISSIONS.STOCK_MANAGE);
  const settings = await getSettings();
  const movement = await prisma.$transaction(async (tx) => {
    const reference = await nextDocumentNumber(tx, "STOCK", settings.stockPrefix);
    const result = await applyStockChange(tx, {
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      referenceNumber: reference,
      notes: input.notes,
      createdById: user.id,
      toLocation: input.toLocation,
      allowNegative: settings.allowNegativeStock,
      absolute: ABSOLUTE.has(input.type),
    });
    await writeAudit(tx, {
      userId: user.id,
      action: input.type,
      entity: "StockMovement",
      entityId: result.movement.id,
      details: { productId: input.productId, reference },
    });
    return result.movement;
  });
  return movement.id;
}

export async function listMovements(query: {
  q?: string;
  type?: StockTransactionType;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
}) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize === 100 ? 100 : 50;
  const where: Prisma.StockMovementWhereInput = {
    type: query.type,
    createdAt: query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    OR: query.q
      ? [
          { referenceNumber: { contains: query.q, mode: "insensitive" } },
          { product: { name: { contains: query.q, mode: "insensitive" } } },
          { product: { sku: { contains: query.q, mode: "insensitive" } } },
        ]
      : undefined,
  };
  const [total, rows] = await prisma.$transaction([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        createdBy: { select: { name: true } },
      },
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: num(row.quantity),
      previousStock: num(row.previousStock),
      newStock: num(row.newStock),
      referenceNumber: row.referenceNumber,
      notes: row.notes,
      fromLocation: row.fromLocation,
      toLocation: row.toLocation,
      product: row.product.name,
      sku: row.product.sku,
      unit: row.product.unit,
      createdBy: row.createdBy.name,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}
