import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSION_CATALOG, ROLE_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const roles: { key: UserRole; name: string; description: string }[] = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Full access, including users and settings" },
  { key: "ADMIN", name: "Admin", description: "Full operational access" },
  { key: "MANAGER", name: "Manager", description: "Products, stock, purchases, sales, and reports" },
  { key: "STAFF", name: "Staff", description: "View products, move stock, and record sales" },
];

const SAMPLE_SKUS = [
  "ELEC-TV-55",
  "ELEC-EB-01",
  "GROC-RICE-5",
  "GROC-OIL-15",
  "BEV-WAT-500",
  "BEV-OJ-1",
  "HARD-DRILL-18",
  "HARD-SCR-10",
  "STAT-PEN-12",
  "STAT-A4-80",
];

async function main() {
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { name: permission.name, description: permission.description },
      create: permission,
    });
  }

  for (const role of roles) {
    const saved = await prisma.role.upsert({
      where: { key: role.key },
      update: { name: role.name, description: role.description },
      create: role,
    });
    const permissions = await prisma.permission.findMany({ where: { key: { in: ROLE_PERMISSIONS[role.key] } } });
    await prisma.rolePermission.deleteMany({ where: { roleId: saved.id } });
    await prisma.rolePermission.createMany({
      data: permissions.map((permission) => ({ roleId: saved.id, permissionId: permission.id })),
    });
  }

  const roleIds = Object.fromEntries(
    (await prisma.role.findMany()).map((role) => [role.key, role.id]),
  ) as Record<UserRole, string>;

  const accounts = [
    { name: "Kasun Jayawardena", email: "admin@stockpro.local", password: "Admin@12345", role: "SUPER_ADMIN" as const },
    { name: "Nimal Perera", email: "manager@stockpro.local", password: "Manager@12345", role: "MANAGER" as const },
    { name: "Sara Fernando", email: "staff@stockpro.local", password: "Staff@12345", role: "STAFF" as const },
  ];

  for (const account of accounts) {
    const passwordHash = await bcrypt.hash(account.password, 12);
    await prisma.user.upsert({
      where: { email: account.email },
      update: { name: account.name, roleId: roleIds[account.role], isActive: true },
      create: { name: account.name, email: account.email, passwordHash, roleId: roleIds[account.role] },
    });
  }

  const company = {
    companyName: "SS Stationers",
    address: "No. 128, Galle Road, Colombo 03, Sri Lanka",
    phone: "+94 11 255 0100",
    email: "accounts@ssstationers.lk",
    currency: "LKR",
    taxName: "VAT",
    taxRate: 18,
    invoiceFooter: "Thank you for shopping at SS Stationers. All prices are in Sri Lankan Rupees.",
    lowStockThreshold: 10,
  };
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: company,
    create: { id: "default", ...company },
  });

  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS product_name_trgm ON "Product" USING gin (name gin_trgm_ops)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS product_sku_trgm ON "Product" USING gin (sku gin_trgm_ops)`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS product_barcode_trgm ON "Product" USING gin (barcode gin_trgm_ops)`);
  } catch (error) {
    console.warn("Trigram search indexes were skipped.", error);
  }

  const sampleProducts = await prisma.product.count({
    where: { OR: [{ sku: { startsWith: "SS-" } }, { sku: { in: SAMPLE_SKUS } }] },
  });
  if (sampleProducts >= 5000) await clearSampleCatalog();
  else console.log("Sample stationery catalog is already cleared.");
}

async function clearSampleCatalog() {
  const sample = { OR: [{ sku: { startsWith: "SS-" } }, { sku: { in: SAMPLE_SKUS } }] };
  await prisma.saleItem.deleteMany({ where: { product: sample } });
  await prisma.purchaseItem.deleteMany({ where: { product: sample } });
  await prisma.stockMovement.deleteMany({ where: { product: sample } });
  const removed = await prisma.product.deleteMany({ where: sample });
  await prisma.purchase.deleteMany({ where: { items: { none: {} } } });
  await prisma.sale.deleteMany({ where: { items: { none: {} } } });
  await prisma.notification.deleteMany();
  await prisma.category.deleteMany({ where: { products: { none: {} } } });
  await prisma.brand.deleteMany({ where: { products: { none: {} } } });
  await prisma.supplier.deleteMany({
    where: { id: { in: ["ss-pettah-stationery", "ss-colombo-paper"] }, products: { none: {} }, purchases: { none: {} } },
  });
  await prisma.customer.deleteMany({
    where: { id: { in: ["ss-royal-bookshop", "ss-office-supplies"] }, sales: { none: {} } },
  });
  await prisma.documentSequence.updateMany({
    where: { key: { in: ["STOCK", "PURCHASE", "SALE"] } },
    data: { value: 0 },
  });
  console.log(`Removed ${removed.count} sample products.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
