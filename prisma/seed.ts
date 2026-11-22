import { Prisma, PrismaClient, StockLevel, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PERMISSION_CATALOG, ROLE_PERMISSIONS } from "../src/lib/permissions";

const prisma = new PrismaClient();

const roles: { key: UserRole; name: string; description: string }[] = [
  { key: "SUPER_ADMIN", name: "Super Admin", description: "Full access, including users and settings" },
  { key: "ADMIN", name: "Admin", description: "Full operational access" },
  { key: "MANAGER", name: "Manager", description: "Products, stock, purchases, sales, and reports" },
  { key: "STAFF", name: "Staff", description: "View products, move stock, and record sales" },
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

  const loaded = await prisma.product.count({ where: { sku: { startsWith: "SS-" } } });
  if (loaded >= 5000) {
    console.log(`SS Stationers catalog already has ${loaded} products.`);
    return;
  }

  await loadStationeryCatalog();
  console.log("Seeded SS Stationers with a stationery catalog of more than 5,000 products.");
}

const OLD_SKUS = [
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

type CatalogItem = {
  name: string;
  category: string;
  brand: string;
  unit: string;
  purchase: number;
  selling: number;
  min: number;
};

function pushVariants(rows: CatalogItem[], input: { names: string[]; variants: string[][]; category: string; brand: string; unit: string; purchase: number; selling: number; min: number }) {
  const combos = input.variants.reduce<string[][]>((current, group) => current.flatMap((prefix) => group.map((value) => [...prefix, value])), [[]]);
  for (const name of input.names) {
    for (const combo of combos) {
      const label = `${name} ${combo.join(" ")}`;
      const packed = /Box|Carton|Ream/.test(label);
      rows.push({
        name: label,
        category: input.category,
        brand: input.brand,
        unit: packed ? "BOX" : /Pack/.test(label) ? "PACK" : input.unit,
        purchase: input.purchase,
        selling: input.selling,
        min: input.min,
      });
    }
  }
}

function stationeryCatalog(): CatalogItem[] {
  const rows: CatalogItem[] = [];
  const colors = ["Black", "Blue", "Red", "Green", "Navy", "Violet", "Orange", "Assorted"];
  const packs = ["Single", "Pack of 10", "Box of 50"];
  const tips = ["0.5 mm", "0.7 mm", "1.0 mm"];
  pushVariants(rows, {
    names: ["Atlas Chooty Ballpoint Pen", "Atlas Gem Ballpoint Pen", "Pilot G2 Gel Pen", "Pilot V5 Hi-Tecpoint", "Reynolds Brite Pen", "Uniball Eye Fine", "Fountain Pen", "Fineliner Pen"],
    variants: [colors, tips, packs],
    category: "Writing",
    brand: "Pilot",
    unit: "PCS",
    purchase: 35,
    selling: 65,
    min: 24,
  });
  pushVariants(rows, {
    names: ["Highlighter", "Whiteboard Marker", "Permanent Marker", "Paint Marker", "Correction Pen", "Brush Pen", "Sign Pen", "Rollerball Pen"],
    variants: [colors, packs],
    category: "Writing",
    brand: "Stabilo",
    unit: "PCS",
    purchase: 55,
    selling: 95,
    min: 12,
  });
  pushVariants(rows, {
    names: ["Drawing Pencil", "Sketch Pencil", "Exam Pencil", "Color Pencil", "Mechanical Pencil", "Charcoal Pencil"],
    variants: [["HB", "2B", "4B", "6B", "H", "2H"], ["Single", "Pack of 10", "Box of 12"]],
    category: "Writing",
    brand: "Faber-Castell",
    unit: "PCS",
    purchase: 20,
    selling: 40,
    min: 24,
  });
  pushVariants(rows, {
    names: ["Photocopy Paper", "Color Paper", "Bond Paper", "Graph Paper", "Ruled Paper", "Drawing Paper", "Sticker Paper", "Art Card", "Tracing Paper", "Carbon Paper"],
    variants: [["A3", "A4", "A5", "Letter", "Legal", "Foolscap"], ["70 gsm", "80 gsm", "100 gsm", "120 gsm"], ["Ream", "Box of 5 Reams", "Carton of 10 Reams"]],
    category: "Paper",
    brand: "Double A",
    unit: "BOX",
    purchase: 980,
    selling: 1450,
    min: 8,
  });
  pushVariants(rows, {
    names: ["Exercise Book", "Note Book", "Shorthand Book", "Practical Book", "CR Book", "Single Rule Book", "Square Rule Book", "Drawing Book"],
    variants: [["A4", "A5", "Crown", "Foolscap"], ["40 pages", "80 pages", "120 pages", "160 pages", "200 pages"], ["Single Rule", "Square Rule", "Plain", "Four Line"], ["Soft Cover", "Hard Cover", "Laminated Cover", "Spiral Cover"]],
    category: "Books and Pads",
    brand: "Atlas",
    unit: "PCS",
    purchase: 80,
    selling: 140,
    min: 12,
  });
  pushVariants(rows, {
    names: ["Ring Binder", "Lever Arch File", "Box File", "Document Wallet", "Clear Folder", "Spring File", "Report File", "Zip Folder", "Magazine File", "Hanging File"],
    variants: [["A4", "A3", "Foolscap", "Legal"], ["Black", "Blue", "Red", "Green", "Yellow", "Grey", "Clear", "Assorted"]],
    category: "Files and Folders",
    brand: "Deli",
    unit: "PCS",
    purchase: 180,
    selling: 320,
    min: 6,
  });
  pushVariants(rows, {
    names: ["Stapler", "Staple Remover", "Hole Punch", "Tape Dispenser", "Scissors", "Paper Cutter", "Desk Organizer", "Pen Stand", "Paper Clip Box", "Binder Clip", "Push Pin Box", "Rubber Band Box", "Glue Stick", "Liquid Glue", "Correction Tape", "Ruler", "Scale Set", "Sharpener", "Eraser", "Calculator", "Stamp Pad", "Ink Bottle", "Date Stamp", "Clipboard"],
    variants: [["Black", "Blue", "Red", "Green", "Grey", "White"], ["Small", "Large"]],
    category: "Desk Supplies",
    brand: "Deli",
    unit: "PCS",
    purchase: 250,
    selling: 450,
    min: 6,
  });
  pushVariants(rows, {
    names: ["Geometry Box", "School Bag", "Pencil Case", "Water Color Set", "Poster Color Set", "Clay Set", "Slate", "Slate Pencil", "ID Card Holder", "Lanyard", "Name Label Pack", "Book Cover Roll", "School Diary", "Exam Pad", "Answer Sheet Pad"],
    variants: [["Small", "Medium", "Large", "Junior", "Senior", "Pack"]],
    category: "School Supplies",
    brand: "Maped",
    unit: "PCS",
    purchase: 350,
    selling: 650,
    min: 8,
  });
  pushVariants(rows, {
    names: ["Poster Color", "Water Color Cake", "Acrylic Color", "Oil Pastel", "Wax Crayon", "Sketch Pen", "Brush", "Palette", "Canvas Pad", "Craft Paper"],
    variants: [["Red", "Blue", "Yellow", "Green", "Black", "White", "Brown", "Orange", "Pink", "Violet", "Assorted", "Gold"], ["12 ml", "25 ml", "50 ml"]],
    category: "Art and Craft",
    brand: "Faber-Castell",
    unit: "PCS",
    purchase: 120,
    selling: 220,
    min: 10,
  });
  pushVariants(rows, {
    names: ["Envelope"],
    variants: [["DL", "C5", "C4", "C3", "9x4", "10x12"], ["White", "Brown", "Manila", "Blue", "Assorted"], ["Pack of 25", "Pack of 50", "Pack of 100"]],
    category: "Paper",
    brand: "Double A",
    unit: "PACK",
    purchase: 180,
    selling: 280,
    min: 10,
  });
  pushVariants(rows, {
    names: ["Calculator", "Laminating Pouch", "Binding Cover", "Spiral Coil", "Thermal Roll", "Ink Cartridge", "Ribbon Cartridge", "Label Roll", "Self-inking Stamp", "Lamination Machine"],
    variants: [["Small", "Medium", "Large", "A4", "A3", "100 sheets"]],
    category: "Office Machines",
    brand: "Casio",
    unit: "PCS",
    purchase: 1450,
    selling: 2490,
    min: 4,
  });
  if (rows.length < 5200) throw new Error(`Stationery catalog has ${rows.length} products, which is below 5,200.`);
  return rows.slice(0, 5200);
}

function stockFor(index: number, min: number) {
  if (index % 40 === 0) return 0;
  if (index % 11 === 0) return Math.max(1, Math.floor(min / 2));
  return 12 + (index % 180);
}

function levelFor(quantity: number, min: number): StockLevel {
  if (quantity <= 0) return "OUT_OF_STOCK";
  if (quantity <= min) return "LOW_STOCK";
  return "IN_STOCK";
}

async function createInBatches<T extends Prisma.ProductCreateManyInput | Prisma.StockMovementCreateManyInput>(model: "product" | "stockMovement", rows: T[]) {
  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500);
    if (model === "product") await prisma.product.createMany({ data: batch as Prisma.ProductCreateManyInput[] });
    else await prisma.stockMovement.createMany({ data: batch as Prisma.StockMovementCreateManyInput[] });
  }
}

async function loadStationeryCatalog() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { email: "admin@stockpro.local" } });
  const removing = await prisma.product.findMany({
    where: { OR: [{ sku: { startsWith: "SS-" } }, { sku: { in: OLD_SKUS } }] },
    select: { id: true },
  });
  const ids = removing.map((product) => product.id);
  if (ids.length) {
    await prisma.saleItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.purchaseItem.deleteMany({ where: { productId: { in: ids } } });
    await prisma.stockMovement.deleteMany({ where: { productId: { in: ids } } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.purchase.deleteMany({ where: { items: { none: {} } } });
  await prisma.sale.deleteMany({ where: { items: { none: {} } } });
  await prisma.notification.deleteMany();
  await prisma.category.deleteMany({ where: { products: { none: {} } } });
  await prisma.brand.deleteMany({ where: { products: { none: {} } } });

  const catalog = stationeryCatalog();
  const categoryNames = [...new Set(catalog.map((item) => item.category))];
  const brandNames = [...new Set(catalog.map((item) => item.brand))];
  const categories = new Map<string, string>();
  for (const name of categoryNames) {
    const saved = await prisma.category.upsert({
      where: { name },
      update: { description: `${name} for schools and offices` },
      create: { name, description: `${name} for schools and offices` },
    });
    categories.set(name, saved.id);
  }
  const brands = new Map<string, string>();
  for (const name of brandNames) {
    const saved = await prisma.brand.upsert({ where: { name }, update: {}, create: { name } });
    brands.set(name, saved.id);
  }
  const pettah = await prisma.supplier.upsert({
    where: { id: "ss-pettah-stationery" },
    update: {},
    create: {
      id: "ss-pettah-stationery",
      name: "Pettah Stationery Mart",
      companyName: "Pettah Stationery Mart",
      contactPerson: "Ruwan Silva",
      phone: "+94 11 244 3300",
      email: "sales@pettahstationery.lk",
      address: "Pettah, Colombo 11",
    },
  });
  const paperHouse = await prisma.supplier.upsert({
    where: { id: "ss-colombo-paper" },
    update: {},
    create: {
      id: "ss-colombo-paper",
      name: "Colombo Paper House",
      companyName: "Colombo Paper House",
      contactPerson: "Kavindi Silva",
      phone: "+94 11 232 1180",
      email: "orders@colombopaper.lk",
      address: "Wolfendhal Street, Colombo 13",
    },
  });
  await prisma.customer.upsert({
    where: { id: "ss-royal-bookshop" },
    update: {},
    create: { id: "ss-royal-bookshop", name: "Royal College Bookshop", phone: "+94 11 269 2162", email: "bookshop@royalcollege.lk", address: "Rajakeeya Mawatha, Colombo 07" },
  });
  await prisma.customer.upsert({
    where: { id: "ss-office-supplies" },
    update: {},
    create: { id: "ss-office-supplies", name: "Colombo Office Supplies", phone: "+94 11 257 4400", email: "buying@colombooffice.lk", address: "York Street, Colombo 01" },
  });

  const aisles = ["A", "B", "C", "D", "E", "F"];
  const products: Prisma.ProductCreateManyInput[] = catalog.map((item, index) => {
    const quantity = stockFor(index, item.min);
    const paper = item.category === "Paper";
    return {
      name: item.name,
      sku: `SS-${String(index + 1).padStart(5, "0")}`,
      barcode: `479${String(index + 1).padStart(10, "0")}`,
      categoryId: categories.get(item.category)!,
      brandId: brands.get(item.brand)!,
      purchasePrice: item.purchase,
      sellingPrice: item.selling,
      quantity,
      minStock: item.min,
      unit: item.unit,
      location: `${aisles[index % aisles.length]}-${String((index % 20) + 1).padStart(2, "0")}`,
      supplierId: paper ? paperHouse.id : pettah.id,
      stockLevel: levelFor(quantity, item.min),
    };
  });
  await createInBatches("product", products);

  const saved = await prisma.product.findMany({
    where: { sku: { startsWith: "SS-" } },
    select: { id: true, sku: true, quantity: true },
    orderBy: { sku: "asc" },
  });
  const movements: Prisma.StockMovementCreateManyInput[] = saved.map((product) => {
    const sequence = Number(product.sku.slice(3));
    const quantity = Number(product.quantity);
    return {
      productId: product.id,
      type: "OPENING",
      quantity,
      previousStock: 0,
      newStock: quantity,
      referenceNumber: `STK-2026-${String(sequence).padStart(5, "0")}`,
      notes: "Opening stock",
      createdById: admin.id,
    };
  });
  await createInBatches("stockMovement", movements);

  const paperProduct = await prisma.product.findFirstOrThrow({ where: { name: "Photocopy Paper A4 80 gsm Ream" } });
  const quantity = 20;
  const unitPrice = Number(paperProduct.purchasePrice);
  const subtotal = quantity * unitPrice;
  const taxAmount = Math.round(subtotal * 0.18);
  const purchase = await prisma.purchase.create({
    data: {
      invoiceNumber: "PO-2026-00001",
      supplierId: paperHouse.id,
      date: new Date(),
      status: "PENDING",
      subtotal,
      taxRate: 18,
      taxAmount,
      total: subtotal + taxAmount,
      createdById: admin.id,
      items: { create: [{ productId: paperProduct.id, quantity, unitPrice, total: subtotal }] },
    },
  });
  await prisma.notification.create({
    data: { type: "NEW_PURCHASE", title: "Purchase created", message: "PO-2026-00001 is waiting to be received.", link: `/purchases/${purchase.id}` },
  });
  await prisma.documentSequence.upsert({
    where: { key: "STOCK" },
    create: { key: "STOCK", value: catalog.length },
    update: { value: catalog.length },
  });
  const purchaseSeq = await prisma.documentSequence.findUnique({ where: { key: "PURCHASE" } });
  if (!purchaseSeq || purchaseSeq.value < 1) {
    await prisma.documentSequence.upsert({
      where: { key: "PURCHASE" },
      create: { key: "PURCHASE", value: 1 },
      update: { value: 1 },
    });
  }
  console.log(`Loaded ${saved.length} stationery products with opening stock.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
