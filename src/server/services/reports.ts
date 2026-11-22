import { Prisma } from "@prisma/client";
import { ReportType } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";

export type ReportFilters = {
  q?: string;
  categoryId?: string;
  from?: Date;
  to?: Date;
  page?: number;
  pageSize?: number;
};

export type ReportData = {
  title: string;
  columns: string[];
  rows: (string | number)[][];
  total: number;
  page: number;
  pageSize: number;
};

function productSearch(q?: string, categoryId?: string): Prisma.ProductWhereInput {
  return {
    categoryId: categoryId || undefined,
    OR: q
      ? [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { barcode: { contains: q, mode: "insensitive" } },
        ]
      : undefined,
  };
}

function dateRange(from?: Date, to?: Date) {
  if (!from && !to) return undefined;
  return { gte: from, lte: to };
}

export async function buildReport(type: ReportType, filters: ReportFilters, paginate = true): Promise<ReportData> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = paginate ? (filters.pageSize === 100 ? 100 : 50) : 10000;
  const skip = paginate ? (page - 1) * pageSize : 0;

  if (type === "stock" || type === "low-stock" || type === "out-of-stock" || type === "valuation") {
    const where: Prisma.ProductWhereInput = {
      ...productSearch(filters.q, filters.categoryId),
      stockLevel: type === "low-stock" ? "LOW_STOCK" : type === "out-of-stock" ? "OUT_OF_STOCK" : undefined,
      status: type === "stock" || type === "valuation" ? "ACTIVE" : undefined,
    };
    const [total, products] = await prisma.$transaction([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        orderBy: { name: "asc" },
        skip,
        take: pageSize,
        include: { category: { select: { name: true } }, brand: { select: { name: true } } },
      }),
    ]);
    const valuation = type === "valuation";
    return {
      title: type === "low-stock" ? "Low Stock" : type === "out-of-stock" ? "Out of Stock" : valuation ? "Product Valuation" : "Current Stock",
      columns: valuation
        ? ["Product", "SKU", "Category", "Qty", "Unit", "Cost", "Selling", "Stock value", "Retail value"]
        : ["Product", "SKU", "Category", "Brand", "Qty", "Unit", "Min", "Cost", "Value", "Status"],
      rows: products.map((product) => {
        const quantity = num(product.quantity);
        const cost = num(product.purchasePrice);
        const selling = num(product.sellingPrice);
        return valuation
          ? [product.name, product.sku, product.category.name, quantity, product.unit, cost, selling, Math.round(quantity * cost * 100) / 100, Math.round(quantity * selling * 100) / 100]
          : [product.name, product.sku, product.category.name, product.brand?.name ?? "—", quantity, product.unit, num(product.minStock), cost, Math.round(quantity * cost * 100) / 100, product.stockLevel];
      }),
      total,
      page,
      pageSize,
    };
  }

  if (type === "stock-in" || type === "stock-out") {
    const where: Prisma.StockMovementWhereInput = {
      createdAt: dateRange(filters.from, filters.to),
      product: productSearch(filters.q, filters.categoryId),
      type: { in: type === "stock-in" ? ["STOCK_IN", "PURCHASE", "RETURNED", "OPENING"] : ["STOCK_OUT", "SALE", "DAMAGED"] },
    };
    const [total, rows] = await prisma.$transaction([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        include: { product: { select: { name: true, sku: true, unit: true, category: { select: { name: true } } } }, createdBy: { select: { name: true } } },
      }),
    ]);
    return {
      title: type === "stock-in" ? "Stock In" : "Stock Out",
      columns: ["Date", "Reference", "Product", "SKU", "Category", "Type", "Qty", "Previous", "New", "By"],
      rows: rows.map((row) => [
        row.createdAt.toISOString().slice(0, 16).replace("T", " "),
        row.referenceNumber,
        row.product.name,
        row.product.sku,
        row.product.category.name,
        row.type,
        num(row.quantity),
        num(row.previousStock),
        num(row.newStock),
        row.createdBy.name,
      ]),
      total,
      page,
      pageSize,
    };
  }

  if (type === "purchases") {
    const where: Prisma.PurchaseWhereInput = {
      date: dateRange(filters.from, filters.to),
      items: filters.q || filters.categoryId ? { some: { product: productSearch(filters.q, filters.categoryId) } } : undefined,
    };
    const [total, rows] = await prisma.$transaction([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        orderBy: { date: "desc" },
        skip,
        take: pageSize,
        include: { supplier: { select: { name: true } } },
      }),
    ]);
    return {
      title: "Purchases",
      columns: ["Date", "Invoice", "Supplier", "Status", "Subtotal", "Tax", "Total"],
      rows: rows.map((row) => [row.date.toISOString().slice(0, 10), row.invoiceNumber, row.supplier.name, row.status, num(row.subtotal), num(row.taxAmount), num(row.total)]),
      total,
      page,
      pageSize,
    };
  }

  if (type === "sales" || type === "profit") {
    const where: Prisma.SaleWhereInput = {
      date: dateRange(filters.from, filters.to),
      status: type === "profit" ? "CONFIRMED" : undefined,
      items: filters.q || filters.categoryId ? { some: { product: productSearch(filters.q, filters.categoryId) } } : undefined,
    };
    if (type === "sales") {
      const [total, rows] = await prisma.$transaction([
        prisma.sale.count({ where }),
        prisma.sale.findMany({ where, orderBy: { date: "desc" }, skip, take: pageSize }),
      ]);
      return {
        title: "Sales",
        columns: ["Date", "Invoice", "Customer", "Status", "Payment", "Discount", "Tax", "Total"],
        rows: rows.map((row) => [row.date.toISOString().slice(0, 10), row.invoiceNumber, row.customerName, row.status, row.paymentStatus, num(row.discount), num(row.taxAmount), num(row.total)]),
        total,
        page,
        pageSize,
      };
    }
    const items = await prisma.saleItem.findMany({
      where: { sale: where },
      orderBy: { sale: { date: "desc" } },
      skip,
      take: pageSize,
      include: { sale: true, product: { select: { name: true, sku: true } } },
    });
    const total = await prisma.saleItem.count({ where: { sale: where } });
    return {
      title: "Profit",
      columns: ["Date", "Invoice", "Product", "SKU", "Qty", "Revenue", "Cost", "Profit"],
      rows: items.map((item) => {
        const revenue = num(item.total);
        const cost = Math.round(num(item.costPrice) * num(item.quantity) * 100) / 100;
        return [item.sale.date.toISOString().slice(0, 10), item.sale.invoiceNumber, item.product.name, item.product.sku, num(item.quantity), revenue, cost, Math.round((revenue - cost) * 100) / 100];
      }),
      total,
      page,
      pageSize,
    };
  }

  const suppliers = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    skip,
    take: pageSize,
    include: { purchases: { where: { date: dateRange(filters.from, filters.to), status: { not: "CANCELLED" } }, select: { total: true, date: true } } },
  });
  const total = await prisma.supplier.count();
  return {
    title: "Suppliers",
    columns: ["Supplier", "Orders", "Purchase total", "Last purchase"],
    rows: suppliers.map((supplier) => {
      const totalValue = supplier.purchases.reduce((sum, purchase) => sum + num(purchase.total), 0);
      const last = supplier.purchases.reduce<Date | null>((latest, purchase) => (!latest || purchase.date > latest ? purchase.date : latest), null);
      return [supplier.name, supplier.purchases.length, Math.round(totalValue * 100) / 100, last ? last.toISOString().slice(0, 10) : "—"];
    }),
    total,
    page,
    pageSize,
  };
}
