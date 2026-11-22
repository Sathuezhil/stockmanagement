import { Prisma, ProductStatus, StockLevel } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { emptyToNull, money, num, qty } from "@/lib/utils";
import type { BrandInput, CategoryInput, ProductInput } from "@/lib/validators";
import { nextDocumentNumber, writeAudit } from "@/server/activity";
import { assertPermission, getSettings } from "@/server/guard";
import { applyStockChange, stockLevelFor } from "@/server/stock";
import { AppError } from "@/lib/errors";

function normalizeSku(sku: string) {
  return sku.trim().toUpperCase();
}

function normalizeBarcode(barcode?: string | null) {
  const value = barcode?.trim();
  return value ? value.toUpperCase() : null;
}

async function assertUniqueProduct(sku: string, barcode: string | null, ignoreId?: string) {
  const existingSku = await prisma.product.findFirst({
    where: { sku, NOT: ignoreId ? { id: ignoreId } : undefined },
    select: { id: true },
  });
  if (existingSku) throw new AppError("A product with this SKU already exists.");
  if (!barcode) return;
  const existingBarcode = await prisma.product.findFirst({
    where: { barcode, NOT: ignoreId ? { id: ignoreId } : undefined },
    select: { id: true },
  });
  if (existingBarcode) throw new AppError("A product with this barcode already exists.");
}

export async function saveProduct(input: ProductInput, id?: string) {
  const user = await assertPermission(id ? PERMISSIONS.PRODUCTS_EDIT : PERMISSIONS.PRODUCTS_CREATE);
  const sku = normalizeSku(input.sku);
  const barcode = normalizeBarcode(input.barcode);
  await assertUniqueProduct(sku, barcode, id);
  const maxStock = typeof input.maxStock === "number" && !Number.isNaN(input.maxStock) ? input.maxStock : null;
  const settings = await getSettings();

  const data = {
    name: input.name.trim(),
    sku,
    barcode,
    categoryId: input.categoryId,
    brandId: emptyToNull(input.brandId),
    description: emptyToNull(input.description),
    image: emptyToNull(input.image),
    purchasePrice: money(input.purchasePrice),
    sellingPrice: money(input.sellingPrice),
    minStock: qty(input.minStock),
    maxStock,
    unit: input.unit,
    supplierId: emptyToNull(input.supplierId),
    location: emptyToNull(input.location),
    status: input.status,
  };

  const productId = await prisma.$transaction(async (tx) => {
    if (!id) {
      const created = await tx.product.create({
        data: { ...data, quantity: 0, stockLevel: "OUT_OF_STOCK" },
      });
      const opening = qty(input.quantity ?? 0);
      if (opening > 0) {
        const reference = await nextDocumentNumber(tx, "STOCK", settings.stockPrefix);
        await applyStockChange(tx, {
          productId: created.id,
          type: "OPENING",
          quantity: opening,
          referenceNumber: reference,
          notes: "Opening stock",
          createdById: user.id,
          allowNegative: settings.allowNegativeStock,
          absolute: true,
        });
      } else {
        await tx.product.update({
          where: { id: created.id },
          data: { stockLevel: stockLevelFor(new Prisma.Decimal(0), new Prisma.Decimal(data.minStock)) },
        });
      }
      await writeAudit(tx, { userId: user.id, action: "CREATE", entity: "Product", entityId: created.id, details: { sku } });
      return created.id;
    }

    const current = await tx.product.findUnique({ where: { id }, select: { quantity: true } });
    if (!current) throw new AppError("Product not found.");
    const level = stockLevelFor(current.quantity, new Prisma.Decimal(data.minStock));
    await tx.product.update({ where: { id }, data: { ...data, stockLevel: level } });
    await writeAudit(tx, { userId: user.id, action: "UPDATE", entity: "Product", entityId: id, details: { sku } });
    return id;
  });

  return productId;
}

export async function deleteProduct(id: string) {
  const user = await assertPermission(PERMISSIONS.PRODUCTS_DELETE);
  const product = await prisma.product.findUnique({ where: { id }, select: { id: true, sku: true, name: true } });
  if (!product) throw new AppError("Product not found.");
  await prisma.$transaction(async (tx) => {
    const [purchases, sales] = await Promise.all([
      tx.purchaseItem.count({ where: { productId: id } }),
      tx.saleItem.count({ where: { productId: id } }),
    ]);
    if (purchases > 0 || sales > 0) {
      throw new AppError("This product is on a purchase or sale. Cancel that document before deleting the product.");
    }
    await tx.stockMovement.deleteMany({ where: { productId: id } });
    await tx.product.delete({ where: { id } });
    await writeAudit(tx, { userId: user.id, action: "DELETE", entity: "Product", entityId: id, details: { sku: product.sku, name: product.name } });
  });
}

export type ProductQuery = {
  q?: string;
  categoryId?: string;
  brandId?: string;
  status?: ProductStatus;
  stockLevel?: StockLevel;
  sort?: string;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
};

export async function listProducts(query: ProductQuery) {
  const page = Math.max(1, query.page ?? 1);
  const pageSize = query.pageSize === 100 ? 100 : 50;
  const dir = query.dir === "desc" ? "desc" : "asc";
  const orderBy: Prisma.ProductOrderByWithRelationInput =
    query.sort === "price" ? { sellingPrice: dir } :
    query.sort === "quantity" ? { quantity: dir } :
    query.sort === "date" ? { createdAt: dir } :
    { name: dir };

  const where: Prisma.ProductWhereInput = {
    categoryId: query.categoryId || undefined,
    brandId: query.brandId || undefined,
    status: query.status,
    stockLevel: query.stockLevel,
    OR: query.q
      ? [
          { name: { contains: query.q, mode: "insensitive" } },
          { sku: { contains: query.q, mode: "insensitive" } },
          { barcode: { contains: query.q, mode: "insensitive" } },
        ]
      : undefined,
  };

  const [total, rows] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
        supplier: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      image: product.image,
      categoryId: product.categoryId,
      category: product.category.name,
      brandId: product.brandId,
      brand: product.brand?.name ?? null,
      supplierId: product.supplierId,
      supplier: product.supplier?.name ?? null,
      description: product.description,
      purchasePrice: num(product.purchasePrice),
      sellingPrice: num(product.sellingPrice),
      quantity: num(product.quantity),
      minStock: num(product.minStock),
      maxStock: product.maxStock == null ? null : num(product.maxStock),
      unit: product.unit,
      location: product.location,
      status: product.status,
      stockLevel: product.stockLevel,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    })),
  };
}

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      category: true,
      brand: true,
      supplier: true,
      movements: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { createdBy: { select: { name: true } } },
      },
    },
  });
  if (!product) return null;
  return {
    ...product,
    purchasePrice: num(product.purchasePrice),
    sellingPrice: num(product.sellingPrice),
    quantity: num(product.quantity),
    minStock: num(product.minStock),
    maxStock: product.maxStock == null ? null : num(product.maxStock),
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    movements: product.movements.map((movement) => ({
      id: movement.id,
      type: movement.type,
      quantity: num(movement.quantity),
      previousStock: num(movement.previousStock),
      newStock: num(movement.newStock),
      referenceNumber: movement.referenceNumber,
      notes: movement.notes,
      createdBy: movement.createdBy.name,
      createdAt: movement.createdAt.toISOString(),
    })),
  };
}

export async function listCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    image: row.image,
    productCount: row._count.products,
    createdAt: row.createdAt.toISOString(),
  }));
}

export async function saveCategory(input: CategoryInput, id?: string) {
  const user = await assertPermission(PERMISSIONS.CATEGORIES_MANAGE);
  const name = input.name.trim();
  const duplicate = await prisma.category.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: id ? { id } : undefined },
  });
  if (duplicate) throw new AppError("A category with this name already exists.");
  const data = { name, description: emptyToNull(input.description), image: emptyToNull(input.image) };
  const saved = id
    ? await prisma.category.update({ where: { id }, data })
    : await prisma.category.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Category", entityId: saved.id });
  return saved.id;
}

export async function deleteCategory(id: string) {
  const user = await assertPermission(PERMISSIONS.CATEGORIES_MANAGE);
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) throw new AppError("Move or delete the products in this category before deleting it.");
  await prisma.category.delete({ where: { id } });
  await writeAudit(prisma, { userId: user.id, action: "DELETE", entity: "Category", entityId: id });
}

export async function listBrands() {
  const rows = await prisma.brand.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    productCount: row._count.products,
  }));
}

export async function saveBrand(input: BrandInput, id?: string) {
  const user = await assertPermission(PERMISSIONS.CATEGORIES_MANAGE);
  const name = input.name.trim();
  const duplicate = await prisma.brand.findFirst({
    where: { name: { equals: name, mode: "insensitive" }, NOT: id ? { id } : undefined },
  });
  if (duplicate) throw new AppError("A brand with this name already exists.");
  const data = { name, description: emptyToNull(input.description) };
  const saved = id ? await prisma.brand.update({ where: { id }, data }) : await prisma.brand.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Brand", entityId: saved.id });
  return saved.id;
}

export async function deleteBrand(id: string) {
  const user = await assertPermission(PERMISSIONS.CATEGORIES_MANAGE);
  const count = await prisma.product.count({ where: { brandId: id } });
  if (count > 0) throw new AppError("Products still use this brand. Reassign them before deleting it.");
  await prisma.brand.delete({ where: { id } });
  await writeAudit(prisma, { userId: user.id, action: "DELETE", entity: "Brand", entityId: id });
}
