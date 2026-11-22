import { PaymentStatus, PurchaseStatus } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { emptyToNull, money, num, parseDateInput } from "@/lib/utils";
import type { PurchaseInput, SaleInput } from "@/lib/validators";
import { nextDocumentNumber, notify, writeAudit } from "@/server/activity";
import { assertPermission, getSettings } from "@/server/guard";
import { applyStockChange } from "@/server/stock";
import { AppError } from "@/lib/errors";

function purchaseTotals(items: { quantity: number; unitPrice: number }[], taxRate: number) {
  const subtotal = money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  const taxAmount = money(subtotal * (taxRate / 100));
  return { subtotal, taxAmount, total: money(subtotal + taxAmount) };
}

function saleTotals(items: { quantity: number; unitPrice: number; discount: number }[], discount: number, taxRate: number) {
  for (const item of items) {
    if (item.quantity * item.unitPrice - item.discount < -0.001) {
      throw new AppError("A line discount is larger than the line amount.");
    }
  }
  const subtotal = money(items.reduce((sum, item) => sum + item.quantity * item.unitPrice - item.discount, 0));
  if (discount - subtotal > 0.001) throw new AppError("The order discount is larger than the subtotal.");
  const taxable = money(subtotal - discount);
  const taxAmount = money(taxable * (taxRate / 100));
  return { subtotal, taxAmount, total: money(taxable + taxAmount) };
}

async function uniqueInvoice(model: "purchase" | "sale", invoiceNumber: string, ignoreId?: string) {
  const existing =
    model === "purchase"
      ? await prisma.purchase.findFirst({ where: { invoiceNumber, NOT: ignoreId ? { id: ignoreId } : undefined } })
      : await prisma.sale.findFirst({ where: { invoiceNumber, NOT: ignoreId ? { id: ignoreId } : undefined } });
  if (existing) throw new AppError("That invoice number is already in use.");
}

export async function savePurchase(input: PurchaseInput, options: { id?: string; receive?: boolean }) {
  const user = await assertPermission(PERMISSIONS.PURCHASES_MANAGE);
  const settings = await getSettings();
  const taxRate = money(input.taxRate);
  const totals = purchaseTotals(input.items, taxRate);
  const date = parseDateInput(input.date);

  const id = await prisma.$transaction(async (tx) => {
    if (options.id) {
      const current = await tx.purchase.findUnique({ where: { id: options.id } });
      if (!current) throw new AppError("Purchase not found.");
      if (current.status !== "PENDING" || current.stockApplied) {
        throw new AppError("Only pending purchases can be edited.");
      }
    }

    let invoiceNumber = input.invoiceNumber?.trim();
    if (invoiceNumber) await uniqueInvoice("purchase", invoiceNumber, options.id);
    else if (!options.id) invoiceNumber = await nextDocumentNumber(tx, "PURCHASE", settings.purchasePrefix);
    else {
      const current = await tx.purchase.findUnique({ where: { id: options.id }, select: { invoiceNumber: true } });
      invoiceNumber = current?.invoiceNumber;
    }
    if (!invoiceNumber) throw new AppError("Invoice number is required.");

    const purchase = options.id
      ? await tx.purchase.update({
          where: { id: options.id },
          data: {
            invoiceNumber,
            supplierId: input.supplierId,
            date,
            taxRate,
            notes: emptyToNull(input.notes),
            ...totals,
            items: { deleteMany: {} },
          },
        })
      : await tx.purchase.create({
          data: {
            invoiceNumber,
            supplierId: input.supplierId,
            date,
            taxRate,
            notes: emptyToNull(input.notes),
            createdById: user.id,
            ...totals,
          },
        });

    await tx.purchaseItem.createMany({
      data: input.items.map((item) => ({
        purchaseId: purchase.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: money(item.unitPrice),
        total: money(item.quantity * item.unitPrice),
      })),
    });

    if (options.receive) {
      await receiveInside(tx, purchase.id, user.id, settings.allowNegativeStock);
    } else if (!options.id) {
      await notify(tx, {
        type: "NEW_PURCHASE",
        title: "Purchase created",
        message: `Purchase ${invoiceNumber} was created and is pending.`,
        link: `/purchases/${purchase.id}`,
      });
    }

    await writeAudit(tx, {
      userId: user.id,
      action: options.id ? "UPDATE" : "CREATE",
      entity: "Purchase",
      entityId: purchase.id,
      details: { invoiceNumber, receive: Boolean(options.receive) },
    });
    return purchase.id;
  });

  return id;
}

async function receiveInside(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  userId: string,
  allowNegative: boolean,
) {
  const claimed = await tx.purchase.updateMany({
    where: { id, status: "PENDING", stockApplied: false },
    data: { status: "RECEIVED", stockApplied: true },
  });
  if (claimed.count !== 1) throw new AppError("This purchase was already received or cancelled.");
  const purchase = await tx.purchase.findUniqueOrThrow({ where: { id }, include: { items: true } });
  for (const item of purchase.items) {
    await applyStockChange(tx, {
      productId: item.productId,
      type: "PURCHASE",
      quantity: num(item.quantity),
      referenceNumber: purchase.invoiceNumber,
      notes: `Received on ${purchase.invoiceNumber}`,
      createdById: userId,
      purchaseId: purchase.id,
      allowNegative,
    });
    await tx.product.update({ where: { id: item.productId }, data: { purchasePrice: item.unitPrice } });
  }
  await notify(tx, {
    type: "NEW_PURCHASE",
    title: "Purchase received",
    message: `Purchase ${purchase.invoiceNumber} was received and stock was updated.`,
    link: `/purchases/${purchase.id}`,
  });
}

export async function receivePurchase(id: string) {
  const user = await assertPermission(PERMISSIONS.PURCHASES_MANAGE);
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    await receiveInside(tx, id, user.id, settings.allowNegativeStock);
    await writeAudit(tx, { userId: user.id, action: "RECEIVE", entity: "Purchase", entityId: id });
  });
}

export async function cancelPurchase(id: string) {
  const user = await assertPermission(PERMISSIONS.PURCHASES_MANAGE);
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({ where: { id }, include: { items: true } });
    if (!purchase) throw new AppError("Purchase not found.");
    if (purchase.status === "CANCELLED") throw new AppError("This purchase is already cancelled.");
    if (purchase.status === "RECEIVED" && purchase.stockApplied) {
      for (const item of purchase.items) {
        await applyStockChange(tx, {
          productId: item.productId,
          type: "STOCK_OUT",
          quantity: num(item.quantity),
          referenceNumber: purchase.invoiceNumber,
          notes: `Reversal of cancelled purchase ${purchase.invoiceNumber}`,
          createdById: user.id,
          purchaseId: purchase.id,
          allowNegative: settings.allowNegativeStock,
        });
      }
    }
    const updated = await tx.purchase.updateMany({
      where: { id, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", stockApplied: false },
    });
    if (updated.count !== 1) throw new AppError("This purchase could not be cancelled.");
    await writeAudit(tx, { userId: user.id, action: "CANCEL", entity: "Purchase", entityId: id });
  });
}

export async function listPurchases(query: { q?: string; status?: PurchaseStatus; page?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 50;
  const where = {
    status: query.status,
    OR: query.q
      ? [
          { invoiceNumber: { contains: query.q, mode: "insensitive" as const } },
          { supplier: { name: { contains: query.q, mode: "insensitive" as const } } },
        ]
      : undefined,
  };
  const [total, rows] = await prisma.$transaction([
    prisma.purchase.count({ where }),
    prisma.purchase.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { supplier: { select: { name: true } }, _count: { select: { items: true } } },
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      supplier: row.supplier.name,
      supplierId: row.supplierId,
      date: row.date.toISOString(),
      status: row.status,
      total: num(row.total),
      itemCount: row._count.items,
      stockApplied: row.stockApplied,
    })),
  };
}

export async function getPurchase(id: string) {
  const purchase = await prisma.purchase.findUnique({
    where: { id },
    include: {
      supplier: true,
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
    },
  });
  if (!purchase) return null;
  return {
    id: purchase.id,
    invoiceNumber: purchase.invoiceNumber,
    supplierId: purchase.supplierId,
    supplier: purchase.supplier,
    date: purchase.date.toISOString().slice(0, 10),
    status: purchase.status,
    subtotal: num(purchase.subtotal),
    taxRate: num(purchase.taxRate),
    taxAmount: num(purchase.taxAmount),
    total: num(purchase.total),
    notes: purchase.notes,
    stockApplied: purchase.stockApplied,
    createdBy: purchase.createdBy.name,
    createdAt: purchase.createdAt.toISOString(),
    items: purchase.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      sku: item.product.sku,
      unit: item.product.unit,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      total: num(item.total),
    })),
  };
}

export async function saveSale(input: SaleInput, options: { id?: string; confirm?: boolean }) {
  const user = await assertPermission(PERMISSIONS.SALES_MANAGE);
  const settings = await getSettings();
  const items = input.items.map((item) => ({ ...item, discount: item.discount ?? 0 }));
  const totals = saleTotals(items, money(input.discount), money(input.taxRate));
  const date = parseDateInput(input.date);

  const id = await prisma.$transaction(async (tx) => {
    if (options.id) {
      const current = await tx.sale.findUnique({ where: { id: options.id } });
      if (!current) throw new AppError("Sale not found.");
      if (current.status !== "DRAFT" || current.stockApplied) throw new AppError("Only draft sales can be edited.");
    }

    let invoiceNumber = input.invoiceNumber?.trim();
    if (invoiceNumber) await uniqueInvoice("sale", invoiceNumber, options.id);
    else if (!options.id) invoiceNumber = await nextDocumentNumber(tx, "SALE", settings.invoicePrefix);
    else invoiceNumber = (await tx.sale.findUnique({ where: { id: options.id }, select: { invoiceNumber: true } }))?.invoiceNumber;
    if (!invoiceNumber) throw new AppError("Invoice number is required.");

    const data = {
      invoiceNumber,
      customerId: emptyToNull(input.customerId),
      customerName: input.customerName.trim(),
      customerPhone: emptyToNull(input.customerPhone),
      customerEmail: emptyToNull(input.customerEmail)?.toLowerCase() ?? null,
      date,
      paymentStatus: input.paymentStatus,
      discount: money(input.discount),
      taxRate: money(input.taxRate),
      notes: emptyToNull(input.notes),
      ...totals,
    };

    const sale = options.id
      ? await tx.sale.update({ where: { id: options.id }, data: { ...data, items: { deleteMany: {} } } })
      : await tx.sale.create({ data: { ...data, createdById: user.id } });

    const products = await tx.product.findMany({
      where: { id: { in: items.map((item) => item.productId) } },
      select: { id: true, purchasePrice: true },
    });
    const costs = new Map(products.map((product) => [product.id, product.purchasePrice]));
    await tx.saleItem.createMany({
      data: items.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: money(item.unitPrice),
        discount: money(item.discount),
        costPrice: costs.get(item.productId) ?? 0,
        total: money(item.quantity * item.unitPrice - item.discount),
      })),
    });

    if (options.confirm) await confirmInside(tx, sale.id, user.id, settings.allowNegativeStock);
    await writeAudit(tx, {
      userId: user.id,
      action: options.id ? "UPDATE" : "CREATE",
      entity: "Sale",
      entityId: sale.id,
      details: { invoiceNumber, confirm: Boolean(options.confirm) },
    });
    return sale.id;
  });
  return id;
}

async function confirmInside(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  id: string,
  userId: string,
  allowNegative: boolean,
) {
  const claimed = await tx.sale.updateMany({
    where: { id, status: "DRAFT", stockApplied: false },
    data: { status: "CONFIRMED", stockApplied: true },
  });
  if (claimed.count !== 1) throw new AppError("This sale was already confirmed or cancelled.");
  const sale = await tx.sale.findUniqueOrThrow({ where: { id }, include: { items: true } });
  const combined = new Map<string, number>();
  for (const item of sale.items) combined.set(item.productId, (combined.get(item.productId) ?? 0) + num(item.quantity));
  for (const [productId, quantity] of combined) {
    await applyStockChange(tx, {
      productId,
      type: "SALE",
      quantity,
      referenceNumber: sale.invoiceNumber,
      notes: `Sale ${sale.invoiceNumber}`,
      createdById: userId,
      saleId: sale.id,
      allowNegative,
    });
  }
  await notify(tx, {
    type: "NEW_SALE",
    title: "Sale confirmed",
    message: `Sale ${sale.invoiceNumber} for ${sale.customerName} was confirmed.`,
    link: `/sales/${sale.id}`,
  });
}

export async function confirmSale(id: string) {
  const user = await assertPermission(PERMISSIONS.SALES_MANAGE);
  const settings = await getSettings();
  await prisma.$transaction(async (tx) => {
    await confirmInside(tx, id, user.id, settings.allowNegativeStock);
    await writeAudit(tx, { userId: user.id, action: "CONFIRM", entity: "Sale", entityId: id });
  });
}

export async function cancelSale(id: string) {
  const user = await assertPermission(PERMISSIONS.SALES_MANAGE);
  await prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({ where: { id }, include: { items: true } });
    if (!sale) throw new AppError("Sale not found.");
    if (sale.status === "CANCELLED") throw new AppError("This sale is already cancelled.");
    if (sale.status === "CONFIRMED" && sale.stockApplied) {
      const combined = new Map<string, number>();
      for (const item of sale.items) combined.set(item.productId, (combined.get(item.productId) ?? 0) + num(item.quantity));
      for (const [productId, quantity] of combined) {
        await applyStockChange(tx, {
          productId,
          type: "RETURNED",
          quantity,
          referenceNumber: sale.invoiceNumber,
          notes: `Reversal of cancelled sale ${sale.invoiceNumber}`,
          createdById: user.id,
          saleId: sale.id,
          allowNegative: true,
        });
      }
    }
    const updated = await tx.sale.updateMany({
      where: { id, status: { not: "CANCELLED" } },
      data: { status: "CANCELLED", stockApplied: false },
    });
    if (updated.count !== 1) throw new AppError("This sale could not be cancelled.");
    await writeAudit(tx, { userId: user.id, action: "CANCEL", entity: "Sale", entityId: id });
  });
}

export async function updateSalePayment(id: string, paymentStatus: PaymentStatus) {
  const user = await assertPermission(PERMISSIONS.SALES_MANAGE);
  const sale = await prisma.sale.findUnique({ where: { id }, select: { status: true } });
  if (!sale) throw new AppError("Sale not found.");
  if (sale.status === "CANCELLED") throw new AppError("Cancelled sales cannot change payment status.");
  await prisma.sale.update({ where: { id }, data: { paymentStatus } });
  await writeAudit(prisma, { userId: user.id, action: "PAYMENT", entity: "Sale", entityId: id, details: { paymentStatus } });
}

export async function listSales(query: { q?: string; status?: "DRAFT" | "CONFIRMED" | "CANCELLED"; page?: number }) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = 50;
  const where = {
    status: query.status,
    OR: query.q
      ? [
          { invoiceNumber: { contains: query.q, mode: "insensitive" as const } },
          { customerName: { contains: query.q, mode: "insensitive" as const } },
        ]
      : undefined,
  };
  const [total, rows] = await prisma.$transaction([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { date: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return {
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((row) => ({
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customerName,
      date: row.date.toISOString(),
      status: row.status,
      paymentStatus: row.paymentStatus,
      total: num(row.total),
      stockApplied: row.stockApplied,
    })),
  };
}

export async function getSale(id: string) {
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: true,
      createdBy: { select: { name: true } },
      items: { include: { product: { select: { name: true, sku: true, unit: true } } } },
    },
  });
  if (!sale) return null;
  return {
    id: sale.id,
    invoiceNumber: sale.invoiceNumber,
    customerId: sale.customerId,
    customerName: sale.customerName,
    customerPhone: sale.customerPhone,
    customerEmail: sale.customerEmail,
    customer: sale.customer,
    date: sale.date.toISOString().slice(0, 10),
    status: sale.status,
    paymentStatus: sale.paymentStatus,
    subtotal: num(sale.subtotal),
    discount: num(sale.discount),
    taxRate: num(sale.taxRate),
    taxAmount: num(sale.taxAmount),
    total: num(sale.total),
    notes: sale.notes,
    stockApplied: sale.stockApplied,
    createdBy: sale.createdBy.name,
    createdAt: sale.createdAt.toISOString(),
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      name: item.product.name,
      sku: item.product.sku,
      unit: item.product.unit,
      quantity: num(item.quantity),
      unitPrice: num(item.unitPrice),
      discount: num(item.discount),
      costPrice: num(item.costPrice),
      total: num(item.total),
    })),
  };
}
