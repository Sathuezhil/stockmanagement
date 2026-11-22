import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { emptyToNull, num } from "@/lib/utils";
import type { CustomerInput, SupplierInput } from "@/lib/validators";
import { writeAudit } from "@/server/activity";
import { assertPermission } from "@/server/guard";
import { AppError } from "@/lib/errors";

export async function listSuppliers() {
  const rows = await prisma.supplier.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { products: true, purchases: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    companyName: row.companyName,
    contactPerson: row.contactPerson,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    productCount: row._count.products,
    purchaseCount: row._count.purchases,
  }));
}

export async function getSupplier(id: string) {
  const supplier = await prisma.supplier.findUnique({
    where: { id },
    include: {
      purchases: {
        orderBy: { date: "desc" },
        take: 25,
        include: { _count: { select: { items: true } } },
      },
    },
  });
  if (!supplier) return null;
  return {
    ...supplier,
    createdAt: supplier.createdAt.toISOString(),
    purchases: supplier.purchases.map((purchase) => ({
      id: purchase.id,
      invoiceNumber: purchase.invoiceNumber,
      date: purchase.date.toISOString(),
      status: purchase.status,
      total: num(purchase.total),
      itemCount: purchase._count.items,
    })),
  };
}

export async function saveSupplier(input: SupplierInput, id?: string) {
  const user = await assertPermission(PERMISSIONS.SUPPLIERS_MANAGE);
  const data = {
    name: input.name.trim(),
    companyName: emptyToNull(input.companyName),
    contactPerson: emptyToNull(input.contactPerson),
    phone: emptyToNull(input.phone),
    email: emptyToNull(input.email)?.toLowerCase() ?? null,
    address: emptyToNull(input.address),
    notes: emptyToNull(input.notes),
  };
  const saved = id
    ? await prisma.supplier.update({ where: { id }, data })
    : await prisma.supplier.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Supplier", entityId: saved.id });
  return saved.id;
}

export async function deleteSupplier(id: string) {
  const user = await assertPermission(PERMISSIONS.SUPPLIERS_MANAGE);
  const purchases = await prisma.purchase.count({ where: { supplierId: id } });
  if (purchases > 0) throw new AppError("This supplier has purchase history and cannot be deleted.");
  await prisma.supplier.delete({ where: { id } });
  await writeAudit(prisma, { userId: user.id, action: "DELETE", entity: "Supplier", entityId: id });
}

export async function listCustomers() {
  const rows = await prisma.customer.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { sales: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    address: row.address,
    notes: row.notes,
    saleCount: row._count.sales,
  }));
}

export async function getCustomer(id: string) {
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { sales: { orderBy: { date: "desc" }, take: 25 } },
  });
  if (!customer) return null;
  return {
    ...customer,
    createdAt: customer.createdAt.toISOString(),
    sales: customer.sales.map((sale) => ({
      id: sale.id,
      invoiceNumber: sale.invoiceNumber,
      date: sale.date.toISOString(),
      status: sale.status,
      paymentStatus: sale.paymentStatus,
      total: num(sale.total),
    })),
  };
}

export async function saveCustomer(input: CustomerInput, id?: string) {
  const user = await assertPermission(PERMISSIONS.CUSTOMERS_MANAGE);
  const data = {
    name: input.name.trim(),
    phone: emptyToNull(input.phone),
    email: emptyToNull(input.email)?.toLowerCase() ?? null,
    address: emptyToNull(input.address),
    notes: emptyToNull(input.notes),
  };
  const saved = id ? await prisma.customer.update({ where: { id }, data }) : await prisma.customer.create({ data });
  await writeAudit(prisma, { userId: user.id, action: id ? "UPDATE" : "CREATE", entity: "Customer", entityId: saved.id });
  return saved.id;
}

export async function deleteCustomer(id: string) {
  const user = await assertPermission(PERMISSIONS.CUSTOMERS_MANAGE);
  const sales = await prisma.sale.count({ where: { customerId: id } });
  if (sales > 0) throw new AppError("This customer has sales history and cannot be deleted.");
  await prisma.customer.delete({ where: { id } });
  await writeAudit(prisma, { userId: user.id, action: "DELETE", entity: "Customer", entityId: id });
}
