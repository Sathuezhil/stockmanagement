import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { num } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  const products = await prisma.product.findMany({
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
    select: { id: true, name: true, sku: true, unit: true, quantity: true, sellingPrice: true, purchasePrice: true, location: true },
  });
  return NextResponse.json(
    products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      unit: product.unit,
      location: product.location,
      quantity: num(product.quantity),
      sellingPrice: num(product.sellingPrice),
      purchasePrice: num(product.purchasePrice),
    })),
  );
}
