import { z } from "zod";
import { UNITS } from "@/lib/constants";

const optionalText = z.string().trim().max(2000).optional().or(z.literal(""));

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, "Name is required").max(160),
    sku: z.string().trim().min(2, "SKU is required").max(64),
    barcode: optionalText,
    categoryId: z.string().min(1, "Choose a category"),
    brandId: z.string().optional().or(z.literal("")),
    description: optionalText,
    image: optionalText,
    purchasePrice: z.coerce.number().min(0, "Purchase price cannot be negative"),
    sellingPrice: z.coerce.number().min(0, "Selling price cannot be negative"),
    quantity: z.coerce.number().min(0, "Quantity cannot be negative").optional(),
    minStock: z.coerce.number().min(0, "Minimum stock cannot be negative"),
    maxStock: z
      .union([z.string(), z.number()])
      .optional()
      .transform((value) => {
        if (value === "" || value == null) return undefined;
        const number = typeof value === "number" ? value : Number(value);
        return Number.isFinite(number) ? number : undefined;
      }),
    unit: z.string().refine((value) => UNITS.includes(value as (typeof UNITS)[number]), "Choose a unit"),
    supplierId: z.string().optional().or(z.literal("")),
    location: z.string().trim().max(120).optional().or(z.literal("")),
    status: z.enum(["ACTIVE", "INACTIVE"]),
  })
  .superRefine((value, ctx) => {
    if (typeof value.maxStock === "number" && !Number.isNaN(value.maxStock) && value.maxStock < value.minStock) {
      ctx.addIssue({ code: "custom", path: ["maxStock"], message: "Maximum stock must be greater than minimum stock" });
    }
  });

export const categorySchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: optionalText,
  image: optionalText,
});

export const brandSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  description: optionalText,
});

export const supplierSchema = z.object({
  name: z.string().trim().min(2, "Supplier name is required").max(120),
  companyName: optionalText,
  contactPerson: optionalText,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  address: optionalText,
  notes: optionalText,
});

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Customer name is required").max(120),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  address: optionalText,
  notes: optionalText,
});

const lineSchema = z.object({
  productId: z.string().min(1, "Choose a product"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unitPrice: z.coerce.number().min(0, "Price cannot be negative"),
  discount: z.coerce.number().min(0).optional(),
});

export const purchaseSchema = z.object({
  supplierId: z.string().min(1, "Choose a supplier"),
  date: z.string().min(1, "Choose a date"),
  invoiceNumber: z.string().trim().max(40).optional().or(z.literal("")),
  taxRate: z.coerce.number().min(0).max(100),
  notes: optionalText,
  items: z.array(lineSchema).min(1, "Add at least one product"),
});

export const saleSchema = z.object({
  customerId: z.string().optional().or(z.literal("")),
  customerName: z.string().trim().min(2, "Customer name is required").max(120),
  customerPhone: z.string().trim().max(30).optional().or(z.literal("")),
  customerEmail: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  date: z.string().min(1, "Choose a date"),
  invoiceNumber: z.string().trim().max(40).optional().or(z.literal("")),
  paymentStatus: z.enum(["UNPAID", "PARTIAL", "PAID"]),
  discount: z.coerce.number().min(0),
  taxRate: z.coerce.number().min(0).max(100),
  notes: optionalText,
  items: z.array(lineSchema).min(1, "Add at least one product"),
});

export const stockSchema = z
  .object({
    productId: z.string().min(1, "Choose a product"),
    type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "TRANSFER", "OPENING", "DAMAGED", "RETURNED"]),
    quantity: z.coerce.number().min(0),
    toLocation: z.string().trim().max(120).optional().or(z.literal("")),
    notes: optionalText,
  })
  .superRefine((value, ctx) => {
    if (value.type === "TRANSFER" && !value.toLocation?.trim()) {
      ctx.addIssue({ code: "custom", path: ["toLocation"], message: "Enter the destination location" });
    }
    if (value.type !== "TRANSFER" && value.quantity <= 0) {
      ctx.addIssue({ code: "custom", path: ["quantity"], message: "Quantity must be greater than zero" });
    }
  });

export const userSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters").optional().or(z.literal("")),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "MANAGER", "STAFF"]),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  isActive: z.boolean(),
});

export const settingsSchema = z.object({
  companyName: z.string().trim().min(2, "Company name is required").max(120),
  logo: optionalText,
  address: optionalText,
  phone: z.string().trim().max(30).optional().or(z.literal("")),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  currency: z.enum(["LKR", "USD", "AED"]),
  taxEnabled: z.boolean(),
  taxName: z.string().trim().min(2).max(40),
  taxRate: z.coerce.number().min(0).max(100),
  invoicePrefix: z.string().trim().min(1).max(10),
  purchasePrefix: z.string().trim().min(1).max(10),
  stockPrefix: z.string().trim().min(1).max(10),
  lowStockThreshold: z.coerce.number().int().min(0).max(100000),
  allowNegativeStock: z.boolean(),
  invoiceFooter: optionalText,
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().max(30).optional().or(z.literal("")),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(6),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(8),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type SupplierInput = z.infer<typeof supplierSchema>;
export type CustomerInput = z.infer<typeof customerSchema>;
export type PurchaseInput = z.infer<typeof purchaseSchema>;
export type SaleInput = z.infer<typeof saleSchema>;
export type StockInput = z.infer<typeof stockSchema>;
export type UserInput = z.infer<typeof userSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordInput = z.infer<typeof passwordSchema>;
