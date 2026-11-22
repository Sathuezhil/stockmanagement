import { redirect } from "next/navigation";
import { ProductForm } from "@/components/products/product-form";
import { PageHeader } from "@/components/data/page-header";
import { auth } from "@/auth";
import { listBrands, listCategories } from "@/server/services/catalog";
import { listSuppliers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("products.create")) redirect("/?error=forbidden");
  const [categories, brands, suppliers] = await Promise.all([listCategories(), listBrands(), listSuppliers()]);
  return (
    <div>
      <PageHeader title="Add product" description="SKU and barcode must be unique. Opening quantity is recorded as a stock movement." />
      <ProductForm categories={categories} brands={brands} suppliers={suppliers} />
    </div>
  );
}
