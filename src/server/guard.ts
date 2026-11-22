import { auth } from "@/auth";
import { AppError } from "@/lib/errors";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";

export async function getCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}

export async function assertPermission(permission: string) {
  const user = await getCurrentUser();
  if (!user) throw new AppError("You must be signed in.");
  if (!user.permissions.includes(permission)) throw new AppError("You do not have permission for this action.");
  return user;
}

export async function getSettings() {
  return prisma.companySettings.upsert({
    where: { id: "default" },
    update: {},
    create: {
      id: "default",
      companyName: "SS Stationers",
      address: "No. 128, Galle Road, Colombo 03, Sri Lanka",
      phone: "+94 11 255 0100",
      email: "accounts@ssstationers.lk",
      currency: "LKR",
      taxName: "VAT",
      taxRate: 18,
      invoiceFooter: "Thank you for shopping at SS Stationers. All prices are in Sri Lankan Rupees.",
    },
  });
}

export async function getSettingsDto() {
  const settings = await getSettings();
  return {
    id: settings.id,
    companyName: settings.companyName,
    logo: settings.logo,
    address: settings.address,
    phone: settings.phone,
    email: settings.email,
    currency: settings.currency,
    taxEnabled: settings.taxEnabled,
    taxName: settings.taxName,
    taxRate: num(settings.taxRate),
    invoicePrefix: settings.invoicePrefix,
    purchasePrefix: settings.purchasePrefix,
    stockPrefix: settings.stockPrefix,
    lowStockThreshold: settings.lowStockThreshold,
    allowNegativeStock: settings.allowNegativeStock,
    invoiceFooter: settings.invoiceFooter,
  };
}
