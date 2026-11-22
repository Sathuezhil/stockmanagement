import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { ProductForm } from "@/components/products/product-form";
import { getProduct, listBrands, listCategories } from "@/server/services/catalog";
import { listSuppliers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("products.edit")) redirect("/?error=forbidden");
  const { id } = await params;
  const [product, categories, brands, suppliers] = await Promise.all([getProduct(id), listCategories(), listBrands(), listSuppliers()]);
  if (!product) notFound();
  return (
    <div>
      <PageHeader title="Edit product" description="Quantity changes are recorded from Stock so every adjustment stays in the history." />
      <ProductForm categories={categories} brands={brands} suppliers={suppliers} product={product} />
    </div>
  );
}
