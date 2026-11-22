import Link from "next/link";
import { redirect } from "next/navigation";
import { ProductStatus, StockLevel } from "@prisma/client";
import { auth } from "@/auth";
import { Pagination, QuerySelect, SearchBox } from "@/components/data/controls";
import { EmptyState, PageHeader } from "@/components/data/page-header";
import { DeleteProductButton } from "@/components/products/delete-product-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney, formatQty } from "@/lib/format";
import { first } from "@/lib/utils";
import { getSettingsDto } from "@/server/guard";
import { listBrands, listCategories, listProducts } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user.permissions.includes("products.view")) redirect("/?error=forbidden");
  const sp = await searchParams;
  const status = first(sp.status);
  const stockLevel = first(sp.stockLevel);
  const query = {
    q: first(sp.q),
    categoryId: first(sp.categoryId),
    brandId: first(sp.brandId),
    status: status === "ACTIVE" || status === "INACTIVE" ? status as ProductStatus : undefined,
    stockLevel: stockLevel === "IN_STOCK" || stockLevel === "LOW_STOCK" || stockLevel === "OUT_OF_STOCK" ? stockLevel as StockLevel : undefined,
    sort: first(sp.sort),
    dir: first(sp.dir) === "desc" ? "desc" as const : "asc" as const,
    page: Number(first(sp.page) ?? 1),
    pageSize: first(sp.pageSize) === "100" ? 100 : 50,
  };
  const [result, categories, brands, settings] = await Promise.all([
    listProducts(query),
    listCategories(),
    listBrands(),
    getSettingsDto(),
  ]);
  const canEdit = session.user.permissions.includes("products.edit");
  const canDelete = session.user.permissions.includes("products.delete");
  const params = {
    q: query.q,
    categoryId: query.categoryId,
    brandId: query.brandId,
    status,
    stockLevel,
    sort: query.sort,
    dir: query.dir,
    pageSize: String(query.pageSize),
  };

  return (
    <div>
      <PageHeader title="Products" description="Search, filter, and page through the catalog without loading every record.">
        <QuerySelect name="pageSize" label="Page size" includeEmpty={false} value={String(query.pageSize)} options={[{ value: "50", label: "50" }, { value: "100", label: "100" }]} />
        {session.user.permissions.includes("products.create") ? <Button asChild><Link href="/products/new">Add product</Link></Button> : null}
      </PageHeader>
      <Card>
        <div className="grid gap-3 border-b border-border p-4 md:grid-cols-2 xl:grid-cols-6">
          <div className="xl:col-span-2"><SearchBox placeholder="Search name, SKU, or barcode" /></div>
          <QuerySelect name="categoryId" label="Category" value={query.categoryId} options={categories.map((item) => ({ value: item.id, label: item.name }))} />
          <QuerySelect name="brandId" label="Brand" value={query.brandId} options={brands.map((item) => ({ value: item.id, label: item.name }))} />
          <QuerySelect name="stockLevel" label="Stock status" value={stockLevel} options={[{ value: "IN_STOCK", label: "In stock" }, { value: "LOW_STOCK", label: "Low stock" }, { value: "OUT_OF_STOCK", label: "Out of stock" }]} />
          <QuerySelect name="sort" label="Sort" value={query.sort} options={[{ value: "name", label: "Name" }, { value: "price", label: "Price" }, { value: "quantity", label: "Quantity" }, { value: "date", label: "Date" }]} />
        </div>
        <div className="flex gap-3 px-4 pt-3">
          <QuerySelect name="status" label="Product status" value={status} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
          <QuerySelect name="dir" label="Direction" includeEmpty={false} value={query.dir} options={[{ value: "asc", label: "Ascending" }, { value: "desc", label: "Descending" }]} />
        </div>
        {result.items.length === 0 ? <EmptyState title="No products found" description="Adjust the filters or add a product." /> : (
          <Table>
            <THead>
              <tr>
                <TH>Product</TH><TH>Category</TH><TH>Price</TH><TH>Stock</TH><TH>Status</TH>{canEdit || canDelete ? <TH /> : null}
              </tr>
            </THead>
            <tbody>
              {result.items.map((product) => (
                <TR key={product.id}>
                  <TD>
                    <Link href={`/products/${product.id}`} className="font-medium hover:underline">{product.name}</Link>
                    <p className="text-xs text-muted-foreground">{product.sku}{product.barcode ? ` · ${product.barcode}` : ""}</p>
                  </TD>
                  <TD>{product.category}{product.brand ? <span className="block text-xs text-muted-foreground">{product.brand}</span> : null}</TD>
                  <TD>{formatMoney(product.sellingPrice, settings.currency)}</TD>
                  <TD>
                    <p>{formatQty(product.quantity, product.unit)}</p>
                    <Badge value={product.stockLevel} />
                  </TD>
                  <TD><Badge value={product.status} /></TD>
                  {canEdit || canDelete ? (
                    <TD className="text-right whitespace-nowrap">
                      {canEdit ? <Button asChild size="sm" variant="outline"><Link href={`/products/${product.id}/edit`}>Edit</Link></Button> : null}
                      {canDelete ? <DeleteProductButton id={product.id} compact /> : null}
                    </TD>
                  ) : null}
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={result.pageSize} params={params} />
      </Card>
    </div>
  );
}
