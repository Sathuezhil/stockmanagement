import Link from "next/link";
import { redirect } from "next/navigation";
import { StockTransactionType } from "@prisma/client";
import { auth } from "@/auth";
import { Pagination, QuerySelect, SearchBox } from "@/components/data/controls";
import { EmptyState, PageHeader } from "@/components/data/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { STOCK_TYPES } from "@/lib/constants";
import { formatDateTime, formatQty, titleCase } from "@/lib/format";
import { first } from "@/lib/utils";
import { listMovements } from "@/server/services/stock";

export const dynamic = "force-dynamic";

const types = new Set<string>(STOCK_TYPES.map((item) => item.value));

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("stock.manage")) redirect("/?error=forbidden");
  const sp = await searchParams;
  const type = first(sp.type);
  const from = first(sp.from);
  const to = first(sp.to);
  const result = await listMovements({
    q: first(sp.q),
    type: type && types.has(type as StockTransactionType) ? type as StockTransactionType : undefined,
    from: from ? new Date(`${from}T00:00:00`) : undefined,
    to: to ? new Date(`${to}T23:59:59`) : undefined,
    page: Number(first(sp.page) ?? 1),
    pageSize: first(sp.pageSize) === "100" ? 100 : 50,
  });
  return (
    <div>
      <PageHeader title="Stock" description="Every receipt, issue, adjustment, transfer, and return is stored with the previous and new quantity.">
        <Button asChild><Link href="/stock/new">New movement</Link></Button>
      </PageHeader>
      <Card>
        <div className="grid gap-3 p-4 md:grid-cols-4">
          <SearchBox placeholder="Search product, SKU, or reference" />
          <QuerySelect name="type" label="Type" value={type} options={STOCK_TYPES.map((item) => ({ value: item.value, label: item.label }))} />
          <form className="contents">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">From<input className="h-10 rounded-lg border border-input bg-card px-3 text-sm" type="date" name="from" defaultValue={from} /></label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">To<input className="h-10 rounded-lg border border-input bg-card px-3 text-sm" type="date" name="to" defaultValue={to} /></label>
          </form>
        </div>
        {result.items.length === 0 ? <EmptyState title="No stock movements" description="Record stock in, stock out, an adjustment, or a transfer." /> : (
          <Table>
            <THead><tr><TH>When</TH><TH>Reference</TH><TH>Product</TH><TH>Type</TH><TH>Qty</TH><TH>Previous</TH><TH>New</TH><TH>By</TH></tr></THead>
            <tbody>
              {result.items.map((item) => (
                <TR key={item.id}>
                  <TD>{formatDateTime(item.createdAt)}</TD>
                  <TD>{item.referenceNumber}</TD>
                  <TD>{item.product}<span className="block text-xs text-muted-foreground">{item.sku}</span></TD>
                  <TD>{titleCase(item.type)}</TD>
                  <TD>{formatQty(item.quantity, item.unit)}</TD>
                  <TD>{formatQty(item.previousStock)}</TD>
                  <TD>{formatQty(item.newStock)}</TD>
                  <TD>{item.createdBy}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={result.pageSize} params={{ q: first(sp.q), type, from, to }} />
      </Card>
    </div>
  );
}
