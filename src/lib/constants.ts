export const UNITS = ["PCS", "KG", "G", "BOX", "LTR", "ML", "MTR", "SET", "PAIR", "DOZEN", "CARTON", "PACK"] as const;

export const CURRENCIES = ["LKR", "USD", "AED"] as const;

export const PAGE_SIZES = [50, 100] as const;

export const MAX_IMAGE_BYTES = 50 * 1024 * 1024;

export const STOCK_TYPES = [
  { value: "STOCK_IN", label: "Stock In" },
  { value: "STOCK_OUT", label: "Stock Out" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "TRANSFER", label: "Transfer" },
  { value: "OPENING", label: "Opening Stock" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "RETURNED", label: "Returned" },
] as const;

export const REPORT_TYPES = [
  { type: "stock", title: "Current Stock", description: "On-hand quantity and value for every active product" },
  { type: "low-stock", title: "Low Stock", description: "Products at or below their minimum level" },
  { type: "out-of-stock", title: "Out of Stock", description: "Products with no available quantity" },
  { type: "stock-in", title: "Stock In", description: "Inbound movements, purchases, returns, and opening stock" },
  { type: "stock-out", title: "Stock Out", description: "Sales, issues, and damaged stock" },
  { type: "purchases", title: "Purchases", description: "Purchase orders and received goods" },
  { type: "sales", title: "Sales", description: "Confirmed and draft sales invoices" },
  { type: "profit", title: "Profit", description: "Revenue, cost, and gross profit by sale line" },
  { type: "valuation", title: "Product Valuation", description: "Inventory value at cost and selling price" },
  { type: "suppliers", title: "Suppliers", description: "Purchase totals grouped by supplier" },
] as const;

export type ReportType = (typeof REPORT_TYPES)[number]["type"];

export function isReportType(value: string): value is ReportType {
  return REPORT_TYPES.some((item) => item.type === value);
}
