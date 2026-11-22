import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";

export async function getDashboard() {
  const [totals, recentMovements, recentPurchases, recentSales, categoryRows, movementMonths, purchaseMonths, saleMonths] =
    await Promise.all([
      prisma.$queryRaw<
        { products: number; categories: number; quantity: string; value: string; low: number; out: number }[]
      >`
        SELECT
          (SELECT COUNT(*) FROM "Product")::int AS products,
          (SELECT COUNT(*) FROM "Category")::int AS categories,
          (SELECT COALESCE(SUM(quantity), 0) FROM "Product")::text AS quantity,
          (SELECT COALESCE(SUM(quantity * "purchasePrice"), 0) FROM "Product")::text AS value,
          (SELECT COUNT(*) FROM "Product" WHERE "stockLevel" = 'LOW_STOCK')::int AS low,
          (SELECT COUNT(*) FROM "Product" WHERE "stockLevel" = 'OUT_OF_STOCK')::int AS "out"
      `,
      prisma.stockMovement.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: { product: { select: { name: true, sku: true } }, createdBy: { select: { name: true } } },
      }),
      prisma.purchase.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: { supplier: { select: { name: true } } },
      }),
      prisma.sale.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
      }),
      prisma.product.groupBy({
        by: ["categoryId"],
        _count: { _all: true },
        _sum: { quantity: true },
        orderBy: { _count: { categoryId: "desc" } },
        take: 6,
      }),
      prisma.$queryRaw<{ month: string; stock_in: string; stock_out: string }[]>`
        SELECT to_char(date_trunc('month', "createdAt"), 'Mon YYYY') AS month,
               COALESCE(SUM(CASE WHEN "newStock" > "previousStock" THEN "newStock" - "previousStock" ELSE 0 END), 0)::text AS stock_in,
               COALESCE(SUM(CASE WHEN "newStock" < "previousStock" THEN "previousStock" - "newStock" ELSE 0 END), 0)::text AS stock_out
        FROM "StockMovement"
        WHERE "createdAt" >= date_trunc('month', NOW()) - INTERVAL '5 months'
        GROUP BY date_trunc('month', "createdAt")
        ORDER BY date_trunc('month', "createdAt")
      `,
      prisma.$queryRaw<{ month: string; total: string }[]>`
        SELECT to_char(date_trunc('month', date), 'Mon YYYY') AS month,
               COALESCE(SUM(total), 0)::text AS total
        FROM "Purchase"
        WHERE status = 'RECEIVED' AND date >= date_trunc('month', NOW()) - INTERVAL '5 months'
        GROUP BY date_trunc('month', date)
        ORDER BY date_trunc('month', date)
      `,
      prisma.$queryRaw<{ month: string; total: string }[]>`
        SELECT to_char(date_trunc('month', date), 'Mon YYYY') AS month,
               COALESCE(SUM(total), 0)::text AS total
        FROM "Sale"
        WHERE status = 'CONFIRMED' AND date >= date_trunc('month', NOW()) - INTERVAL '5 months'
        GROUP BY date_trunc('month', date)
        ORDER BY date_trunc('month', date)
      `,
    ]);

  const categories = await prisma.category.findMany({
    where: { id: { in: categoryRows.map((row) => row.categoryId) } },
    select: { id: true, name: true },
  });
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  const summary = totals[0] ?? { products: 0, categories: 0, quantity: "0", value: "0", low: 0, out: 0 };
  const months = new Map<string, { month: string; stockIn: number; stockOut: number; purchases: number; sales: number }>();
  for (const row of movementMonths) months.set(row.month, { month: row.month, stockIn: Number(row.stock_in), stockOut: Number(row.stock_out), purchases: 0, sales: 0 });
  for (const row of purchaseMonths) {
    const current = months.get(row.month) ?? { month: row.month, stockIn: 0, stockOut: 0, purchases: 0, sales: 0 };
    current.purchases = Number(row.total);
    months.set(row.month, current);
  }
  for (const row of saleMonths) {
    const current = months.get(row.month) ?? { month: row.month, stockIn: 0, stockOut: 0, purchases: 0, sales: 0 };
    current.sales = Number(row.total);
    months.set(row.month, current);
  }

  return {
    products: Number(summary.products),
    categories: Number(summary.categories),
    quantity: Number(summary.quantity),
    value: Number(summary.value),
    low: Number(summary.low),
    out: Number(summary.out),
    movements: recentMovements.map((row) => ({
      id: row.id,
      type: row.type,
      product: row.product.name,
      sku: row.product.sku,
      quantity: num(row.quantity),
      previousStock: num(row.previousStock),
      newStock: num(row.newStock),
      referenceNumber: row.referenceNumber,
      createdBy: row.createdBy.name,
      createdAt: row.createdAt.toISOString(),
    })),
    purchases: recentPurchases.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      supplier: row.supplier.name,
      status: row.status,
      total: num(row.total),
      date: row.date.toISOString(),
    })),
    sales: recentSales.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      customer: row.customerName,
      status: row.status,
      paymentStatus: row.paymentStatus,
      total: num(row.total),
      date: row.date.toISOString(),
    })),
    categoriesChart: categoryRows.map((row) => ({
      name: categoryNames.get(row.categoryId) ?? "Uncategorised",
      products: row._count._all,
      quantity: num(row._sum.quantity),
    })),
    monthly: Array.from(months.values()),
  };
}
