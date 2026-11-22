import Link from "next/link";
import { redirect } from "next/navigation";
import { PurchaseStatus } from "@prisma/client";
import { auth } from "@/auth";
import { Pagination, QuerySelect, SearchBox } from "@/components/data/controls";
import { EmptyState, PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { first } from "@/lib/utils";
import { getSettingsDto } from "@/server/guard";
import { listPurchases } from "@/server/services/commerce";

export const dynamic = "force-dynamic";

export default async function PurchasesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("purchases.manage")) redirect("/?error=forbidden");
  const sp = await searchParams;
  const status = first(sp.status);
  const [result, settings] = await Promise.all([
    listPurchases({
      q: first(sp.q),
      status: status === "PENDING" || status === "RECEIVED" || status === "CANCELLED" ? status as PurchaseStatus : undefined,
      page: Number(first(sp.page) ?? 1),
    }),
    getSettingsDto(),
  ]);
  return (
    <div>
      <PageHeader title="Purchases" description="Receiving a purchase adds stock once. Repeating the action does not add it again.">
        <Button asChild><Link href="/purchases/new">New purchase</Link></Button>
      </PageHeader>
      <Card>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <SearchBox placeholder="Search invoice or supplier" />
          <QuerySelect name="status" label="Status" value={status} options={[{ value: "PENDING", label: "Pending" }, { value: "RECEIVED", label: "Received" }, { value: "CANCELLED", label: "Cancelled" }]} />
        </div>
        {result.items.length === 0 ? <EmptyState title="No purchases" description="Create a purchase order and receive it when the goods arrive." /> : (
          <Table>
            <THead><tr><TH>Invoice</TH><TH>Supplier</TH><TH>Date</TH><TH>Status</TH><TH>Total</TH></tr></THead>
            <tbody>
              {result.items.map((item) => (
                <TR key={item.id}>
                  <TD><Link className="font-medium hover:underline" href={`/purchases/${item.id}`}>{item.invoiceNumber}</Link></TD>
                  <TD>{item.supplier}</TD>
                  <TD>{formatDate(item.date)}</TD>
                  <TD><Badge value={item.status} /></TD>
                  <TD>{formatMoney(item.total, settings.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        )}
        <Pagination page={result.page} pages={result.pages} total={result.total} pageSize={result.pageSize} params={{ q: first(sp.q), status }} />
      </Card>
    </div>
  );
}
