import { PrismaClient } from "@prisma/client";
import { applyStockChange } from "../src/server/stock";

const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.findFirstOrThrow();
  const rows = Array.from({ length: 5000 }, (_, index) => {
    const n = index + 1;
    const quantity = n % 20;
    return {
      name: `Bulk Item ${n}`,
      sku: `BULK-${String(n).padStart(5, "0")}`,
      barcode: `990${String(n).padStart(10, "0")}`,
      categoryId: category.id,
      purchasePrice: 10,
      sellingPrice: 15,
      quantity,
      minStock: 5,
      unit: "PCS",
      stockLevel: quantity === 0 ? "OUT_OF_STOCK" as const : quantity <= 5 ? "LOW_STOCK" as const : "IN_STOCK" as const,
    };
  });
  const insertStarted = Date.now();
  for (let index = 0; index < rows.length; index += 500) {
    await prisma.product.createMany({ data: rows.slice(index, index + 500) });
  }
  const queryStarted = Date.now();
  const found = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: "bulk item 2500", mode: "insensitive" } },
        { sku: { contains: "BULK-02500", mode: "insensitive" } },
        { barcode: { contains: "9900000002500", mode: "insensitive" } },
      ],
    },
    take: 50,
    orderBy: { name: "asc" },
  });
  const paged = await prisma.product.findMany({ where: { sku: { startsWith: "BULK-" } }, skip: 100, take: 50, orderBy: { sku: "asc" } });
  console.log(JSON.stringify({
    insertedMs: queryStarted - insertStarted,
    searchMs: Date.now() - queryStarted,
    searchHits: found.length,
    pageSize: paged.length,
    total: await prisma.product.count(),
  }));

  const sample = await prisma.product.findUniqueOrThrow({ where: { sku: "ELEC-EB-01" } });
  const before = sample.quantity.toString();
  await prisma.$transaction(async (tx) => {
    await applyStockChange(tx, {
      productId: sample.id,
      type: "STOCK_IN",
      quantity: 3,
      referenceNumber: `TEST-IN-${Date.now()}`,
      createdById: (await tx.user.findFirstOrThrow()).id,
      allowNegative: false,
    });
  });
  const afterIn = await prisma.product.findUniqueOrThrow({ where: { id: sample.id } });
  let blocked = false;
  try {
    await prisma.$transaction(async (tx) => {
      await applyStockChange(tx, {
        productId: sample.id,
        type: "STOCK_OUT",
        quantity: 100000,
        referenceNumber: `TEST-OUT-${Date.now()}`,
        createdById: (await tx.user.findFirstOrThrow()).id,
        allowNegative: false,
      });
    });
  } catch {
    blocked = true;
  }
  await prisma.$transaction(async (tx) => {
    await applyStockChange(tx, {
      productId: sample.id,
      type: "ADJUSTMENT",
      quantity: Number(before),
      absolute: true,
      referenceNumber: `TEST-ADJ-${Date.now()}`,
      createdById: (await tx.user.findFirstOrThrow()).id,
      allowNegative: false,
    });
  });
  const restored = await prisma.product.findUniqueOrThrow({ where: { id: sample.id } });
  console.log(JSON.stringify({ before, afterIn: afterIn.quantity.toString(), blockedNegative: blocked, restored: restored.quantity.toString() }));
  await prisma.product.deleteMany({ where: { sku: { startsWith: "BULK-" } } });
  console.log(JSON.stringify({ afterCleanup: await prisma.product.count() }));
}

main().finally(() => prisma.$disconnect());
