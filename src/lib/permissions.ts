export const PERMISSIONS = {
  PRODUCTS_VIEW: "products.view",
  PRODUCTS_CREATE: "products.create",
  PRODUCTS_EDIT: "products.edit",
  PRODUCTS_DELETE: "products.delete",
  STOCK_MANAGE: "stock.manage",
  PURCHASES_MANAGE: "purchases.manage",
  SALES_MANAGE: "sales.manage",
  REPORTS_VIEW: "reports.view",
  USERS_MANAGE: "users.manage",
  SETTINGS_MANAGE: "settings.manage",
  CATEGORIES_MANAGE: "categories.manage",
  SUPPLIERS_MANAGE: "suppliers.manage",
  CUSTOMERS_MANAGE: "customers.manage",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_CATALOG: { key: PermissionKey; name: string; description: string }[] = [
  { key: PERMISSIONS.PRODUCTS_VIEW, name: "View Products", description: "Browse the product catalog" },
  { key: PERMISSIONS.PRODUCTS_CREATE, name: "Add Products", description: "Create new products" },
  { key: PERMISSIONS.PRODUCTS_EDIT, name: "Edit Products", description: "Update product details" },
  { key: PERMISSIONS.PRODUCTS_DELETE, name: "Delete Products", description: "Delete or deactivate products" },
  { key: PERMISSIONS.STOCK_MANAGE, name: "Manage Stock", description: "Record stock movements" },
  { key: PERMISSIONS.PURCHASES_MANAGE, name: "Manage Purchases", description: "Create and receive purchase orders" },
  { key: PERMISSIONS.SALES_MANAGE, name: "Manage Sales", description: "Create and confirm sales" },
  { key: PERMISSIONS.REPORTS_VIEW, name: "View Reports", description: "Open inventory and finance reports" },
  { key: PERMISSIONS.USERS_MANAGE, name: "Manage Users", description: "Create users and assign roles" },
  { key: PERMISSIONS.SETTINGS_MANAGE, name: "System Settings", description: "Update company and invoice settings" },
  { key: PERMISSIONS.CATEGORIES_MANAGE, name: "Manage Categories", description: "Manage categories and brands" },
  { key: PERMISSIONS.SUPPLIERS_MANAGE, name: "Manage Suppliers", description: "Manage supplier records" },
  { key: PERMISSIONS.CUSTOMERS_MANAGE, name: "Manage Customers", description: "Manage customer records" },
];

const ALL = PERMISSION_CATALOG.map((item) => item.key);

export const ROLE_PERMISSIONS: Record<"SUPER_ADMIN" | "ADMIN" | "MANAGER" | "STAFF", PermissionKey[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL,
  MANAGER: ALL.filter((key) => key !== PERMISSIONS.USERS_MANAGE && key !== PERMISSIONS.SETTINGS_MANAGE),
  STAFF: [
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.STOCK_MANAGE,
    PERMISSIONS.SALES_MANAGE,
    PERMISSIONS.CUSTOMERS_MANAGE,
  ],
};

export function hasPermission(permissions: string[] | undefined, key: string) {
  return Boolean(permissions?.includes(key));
}
