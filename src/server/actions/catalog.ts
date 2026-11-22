"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { brandSchema, categorySchema, productSchema } from "@/lib/validators";
import { deleteBrand, deleteCategory, deleteProduct, saveBrand, saveCategory, saveProduct } from "@/server/services/catalog";

function refreshCatalog() {
  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/categories");
  revalidatePath("/brands");
  revalidatePath("/reports");
}

export async function saveProductAction(input: unknown, id?: string) {
  return runAction(async () => {
    const parsed = productSchema.parse(input);
    const productId = await saveProduct(parsed, id);
    refreshCatalog();
    revalidatePath(`/products/${productId}`);
    return { ok: true as const, id: productId, message: id ? "Product updated" : "Product created" };
  });
}

export async function deleteProductAction(id: string) {
  return runAction(async () => {
    await deleteProduct(id);
    refreshCatalog();
    return { ok: true as const, message: "Product deleted" };
  });
}

export async function saveCategoryAction(input: unknown, id?: string) {
  return runAction(async () => {
    const categoryId = await saveCategory(categorySchema.parse(input), id);
    refreshCatalog();
    return { ok: true as const, id: categoryId, message: "Category saved" };
  });
}

export async function deleteCategoryAction(id: string) {
  return runAction(async () => {
    await deleteCategory(id);
    refreshCatalog();
    return { ok: true as const, message: "Category deleted" };
  });
}

export async function saveBrandAction(input: unknown, id?: string) {
  return runAction(async () => {
    const brandId = await saveBrand(brandSchema.parse(input), id);
    refreshCatalog();
    return { ok: true as const, id: brandId, message: "Brand saved" };
  });
}

export async function deleteBrandAction(id: string) {
  return runAction(async () => {
    await deleteBrand(id);
    refreshCatalog();
    return { ok: true as const, message: "Brand deleted" };
  });
}
