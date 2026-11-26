import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime, formatMoney, formatQty, titleCase } from "@/lib/format";
import { getSettingsDto } from "@/server/guard";
import { getProduct } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("products.view")) redirect("/?error=forbidden");
  const { id } = await params;
  const [product, settings] = await Promise.all([getProduct(id), getSettingsDto()]);
  if (!product) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={product.name} description={`${product.sku}${product.barcode ? ` · ${product.barcode}` : ""}`}>
        {session.user.permissions.includes("products.edit") ? <Button asChild variant="outline"><Link href={`/products/${product.id}/edit`}>Edit</Link></Button> : null}
        {session.user.permissions.includes("stock.manage") ? <Button asChild><Link href={`/stock/new?productId=${product.id}`}>Stock movement</Link></Button> : null}
        {session.user.permissions.includes("products.delete") ? <DeleteProductButton id={product.id} /> : null}
      </PageHeader>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <Card>
          <CardContent>
            {product.image ? <img src={product.image} alt="" className="mb-4 h-52 w-full rounded-xl object-cover" /> : <div className="mb-4 flex h-52 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">No image</div>}
            <div className="flex gap-2"><Badge value={product.status} /><Badge value={product.stockLevel} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["Category", product.category.name],
              ["Brand", product.brand?.name ?? "—"],
              ["Supplier", product.supplier?.name ?? "—"],
              ["Purchase per price", formatMoney(product.purchasePrice, settings.currency)],
              ["Selling per price", formatMoney(product.sellingPrice, settings.currency)],
              ["On hand", formatQty(product.quantity, product.unit)],
              ["Minimum", formatQty(product.minStock, product.unit)],
              ["Maximum", product.maxStock == null ? "—" : formatQty(product.maxStock, product.unit)],
              ["Location", product.location ?? "—"],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 font-medium">{value}</p>
              </div>
            ))}
            <div className="sm:col-span-2 lg:col-span-3">
              <p className="text-xs text-muted-foreground">Description</p>
              <p className="mt-1">{product.description || "No description"}</p>
            </div>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 py-4 font-semibold">Stock history</h2>
          <Table>
            <THead><tr><TH>When</TH><TH>Type</TH><TH>Reference</TH><TH>Previous</TH><TH>New</TH><TH>By</TH></tr></THead>
            <tbody>
              {product.movements.length === 0 ? <TR><TD colSpan={6}>No stock movements yet.</TD></TR> : product.movements.map((movement) => (
                <TR key={movement.id}>
                  <TD>{formatDateTime(movement.createdAt)}</TD>
                  <TD>{titleCase(movement.type)}</TD>
                  <TD>{movement.referenceNumber}</TD>
                  <TD>{formatQty(movement.previousStock)}</TD>
                  <TD>{formatQty(movement.newStock)}</TD>
                  <TD>{movement.createdBy}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
