import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const exact = url.searchParams.get("exact") === "1";
  const select = { id: true, name: true, sku: true, barcode: true, unit: true, quantity: true, sellingPrice: true, purchasePrice: true, location: true } as const;
  if (exact && !q) return NextResponse.json([]);
  const products = exact
    ? await prisma.product.findMany({ where: { barcode: q }, take: 1, select })
    : await prisma.product.findMany({
        where: {
          status: "ACTIVE",
          OR: q
            ? [
                { name: { contains: q, mode: "insensitive" } },
                { sku: { contains: q, mode: "insensitive" } },
                { barcode: { contains: q, mode: "insensitive" } },
              ]
            : undefined,
        },
        take: 20,
        orderBy: { name: "asc" },
        select,
      });
  return NextResponse.json(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      barcode: product.barcode,
      unit: product.unit,
      location: product.location,
      quantity: num(product.quantity),
      sellingPrice: num(product.sellingPrice),
      purchasePrice: num(product.purchasePrice),
    })),
  );
}
