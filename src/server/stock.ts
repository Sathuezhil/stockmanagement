import { Prisma, StockLevel, StockTransactionType } from "@prisma/client";
import { AppError } from "@/lib/errors";
import { qty } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

const OUTBOUND = new Set<StockTransactionType>(["STOCK_OUT", "DAMAGED", "SALE"]);

export function stockLevelFor(quantity: Prisma.Decimal, minStock: Prisma.Decimal): StockLevel {
  if (quantity.lte(0)) return "OUT_OF_STOCK";
  if (quantity.lte(minStock)) return "LOW_STOCK";
  return "IN_STOCK";
}

type LockedProduct = {
  id: string;
  quantity: string;
  minStock: string;
  name: string;
  sku: string;
  location: string | null;
};

export async function applyStockChange(
  tx: Tx,
  input: {
    productId: string;
    type: StockTransactionType;
    quantity: number;
    referenceNumber: string;
    notes?: string | null;
    createdById: string;
    purchaseId?: string;
    saleId?: string;
    toLocation?: string | null;
    allowNegative: boolean;
    absolute?: boolean;
  },
) {
  const rows = await tx.$queryRaw<LockedProduct[]>`
    SELECT id, quantity::text AS quantity, "minStock"::text AS "minStock", name, sku, location
    FROM "Product"
    WHERE id = ${input.productId}
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) throw new AppError("Product not found");

  const current = new Prisma.Decimal(row.quantity);
  const minStock = new Prisma.Decimal(row.minStock);
  const amount = new Prisma.Decimal(qty(input.quantity));
  let delta = new Prisma.Decimal(0);
  let location = row.location;

  if (input.absolute || input.type === "ADJUSTMENT" || input.type === "OPENING") {
    if (amount.lt(0)) throw new AppError("Quantity cannot be negative");
    delta = amount.minus(current);
  } else if (input.type === "TRANSFER") {
    if (!input.toLocation?.trim()) throw new AppError("A destination location is required");
    location = input.toLocation.trim();
  } else if (OUTBOUND.has(input.type)) {
    if (amount.lte(0)) throw new AppError("Quantity must be greater than zero");
    delta = amount.negated();
  } else {
    if (amount.lte(0)) throw new AppError("Quantity must be greater than zero");
    delta = amount;
  }

  const next = current.plus(delta);
  if (next.lt(0) && !input.allowNegative) {
    throw new AppError(`Insufficient stock for ${row.name}. Available: ${current.toString()}.`);
  }

  const level = stockLevelFor(next, minStock);
  await tx.product.update({
    where: { id: row.id },
    data: { quantity: next, stockLevel: level, location },
  });

  const movement = await tx.stockMovement.create({
    data: {
      productId: row.id,
      type: input.type,
      quantity: delta.abs(),
      previousStock: current,
      newStock: next,
      referenceNumber: input.referenceNumber,
      notes: input.notes?.trim() || null,
      fromLocation: row.location,
      toLocation: input.type === "TRANSFER" ? location : row.location,
      createdById: input.createdById,
      purchaseId: input.purchaseId,
      saleId: input.saleId,
    },
  });

  if (level === "OUT_OF_STOCK" || level === "LOW_STOCK") {
    const type = level === "OUT_OF_STOCK" ? "OUT_OF_STOCK" : "LOW_STOCK";
    const existing = await tx.notification.findFirst({
      where: { type, isRead: false, link: `/products/${row.id}` },
    });
    if (!existing) {
      await tx.notification.create({
        data: {
          type,
          title: level === "OUT_OF_STOCK" ? "Out of stock" : "Low stock",
          message:
            level === "OUT_OF_STOCK"
              ? `${row.name} (${row.sku}) is out of stock.`
              : `${row.name} (${row.sku}) is at ${next.toString()}, which is at or below its minimum.`,
          link: `/products/${row.id}`,
        },
      });
    }
  }

  if (input.type === "ADJUSTMENT") {
    await tx.notification.create({
      data: {
        type: "STOCK_ADJUSTMENT",
        title: "Stock adjusted",
        message: `${row.name} (${row.sku}) changed from ${current.toString()} to ${next.toString()}.`,
        link: "/stock",
      },
    });
  }

  return { movement, previous: current, next, level, name: row.name, sku: row.sku };
}
