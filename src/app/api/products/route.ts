import { auth } from "@/auth";
import { listProducts, type ProductQuery } from "@/server/services/catalog";
import { ProductStatus, StockLevel } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.permissions.includes("products.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const stockLevel = url.searchParams.get("stockLevel");
  const query: ProductQuery = {
    q: url.searchParams.get("q") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    brandId: url.searchParams.get("brandId") ?? undefined,
    status: status === "ACTIVE" || status === "INACTIVE" ? (status as ProductStatus) : undefined,
    stockLevel: stockLevel === "IN_STOCK" || stockLevel === "LOW_STOCK" || stockLevel === "OUT_OF_STOCK" ? (stockLevel as StockLevel) : undefined,
    sort: url.searchParams.get("sort") ?? undefined,
    dir: url.searchParams.get("dir") === "desc" ? "desc" : "asc",
    page: Number(url.searchParams.get("page") ?? 1),
    pageSize: Number(url.searchParams.get("pageSize") ?? 50),
  };
  const result = await listProducts(query);
  return NextResponse.json(result);
}
