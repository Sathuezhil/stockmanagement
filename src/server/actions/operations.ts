"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { customerSchema, purchaseSchema, saleSchema, stockSchema, supplierSchema } from "@/lib/validators";
import { cancelPurchase, cancelSale, confirmSale, receivePurchase, savePurchase, saveSale, updateSalePayment } from "@/server/services/commerce";
import { deleteCustomer, deleteSupplier, saveCustomer, saveSupplier } from "@/server/services/parties";
import { recordStockMovement } from "@/server/services/stock";

export async function saveSupplierAction(input: unknown, id?: string) {
  return runAction(async () => {
    const supplierId = await saveSupplier(supplierSchema.parse(input), id);
    revalidatePath("/suppliers");
    return { ok: true as const, id: supplierId, message: "Supplier saved" };
  });
}

export async function deleteSupplierAction(id: string) {
  return runAction(async () => {
    await deleteSupplier(id);
    revalidatePath("/suppliers");
    return { ok: true as const, message: "Supplier deleted" };
  });
}

export async function saveCustomerAction(input: unknown, id?: string) {
  return runAction(async () => {
    const customerId = await saveCustomer(customerSchema.parse(input), id);
    revalidatePath("/customers");
    return { ok: true as const, id: customerId, message: "Customer saved" };
  });
}

export async function deleteCustomerAction(id: string) {
  return runAction(async () => {
    await deleteCustomer(id);
    revalidatePath("/customers");
    return { ok: true as const, message: "Customer deleted" };
  });
}

export async function recordStockAction(input: unknown) {
  return runAction(async () => {
    const id = await recordStockMovement(stockSchema.parse(input));
    revalidatePath("/");
    revalidatePath("/stock");
    revalidatePath("/products");
    revalidatePath("/notifications");
    return { ok: true as const, id, message: "Stock movement recorded" };
  });
}

export async function savePurchaseAction(input: unknown, options: { id?: string; receive?: boolean }) {
  return runAction(async () => {
    const id = await savePurchase(purchaseSchema.parse(input), options);
    revalidatePath("/purchases");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true as const, id, message: options.receive ? "Purchase received" : "Purchase saved" };
  });
}

export async function receivePurchaseAction(id: string) {
  return runAction(async () => {
    await receivePurchase(id);
    revalidatePath("/purchases");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true as const, message: "Stock updated from this purchase" };
  });
}

export async function cancelPurchaseAction(id: string) {
  return runAction(async () => {
    await cancelPurchase(id);
    revalidatePath("/purchases");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true as const, message: "Purchase cancelled" };
  });
}

export async function saveSaleAction(input: unknown, options: { id?: string; confirm?: boolean }) {
  return runAction(async () => {
    const id = await saveSale(saleSchema.parse(input), options);
    revalidatePath("/sales");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true as const, id, message: options.confirm ? "Sale confirmed" : "Sale saved" };
  });
}

export async function confirmSaleAction(id: string) {
  return runAction(async () => {
    await confirmSale(id);
    revalidatePath("/sales");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true as const, message: "Sale confirmed and stock reduced" };
  });
}

export async function cancelSaleAction(id: string) {
  return runAction(async () => {
    await cancelSale(id);
    revalidatePath("/sales");
    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/stock");
    return { ok: true as const, message: "Sale cancelled" };
  });
}

export async function updatePaymentAction(id: string, paymentStatus: "UNPAID" | "PARTIAL" | "PAID") {
  return runAction(async () => {
    await updateSalePayment(id, paymentStatus);
    revalidatePath("/sales");
    revalidatePath(`/sales/${id}`);
    return { ok: true as const, message: "Payment status updated" };
  });
}
