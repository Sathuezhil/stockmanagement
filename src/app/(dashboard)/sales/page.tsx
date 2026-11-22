import Link from "next/link";
import { redirect } from "next/navigation";
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
import { listSales } from "@/server/services/commerce";

export const dynamic = "force-dynamic";

export default async function SalesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("sales.manage")) redirect("/?error=forbidden");
  const sp = await searchParams;
  const status = first(sp.status);
  const [result, settings] = await Promise.all([
    listSales({
      q: first(sp.q),
      status: status === "DRAFT" || status === "CONFIRMED" || status === "CANCELLED" ? status : undefined,
      page: Number(first(sp.page) ?? 1),
    }),
    getSettingsDto(),
  ]);
  return (
    <div>
      <PageHeader title="Sales" description="Confirming a sale reduces stock. A sale cannot take more than the available quantity.">
        <Button asChild><Link href="/sales/new">New sale</Link></Button>
      </PageHeader>
      <Card>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <SearchBox placeholder="Search invoice or customer" />
          <QuerySelect name="status" label="Status" value={status} options={[{ value: "DRAFT", label: "Draft" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "CANCELLED", label: "Cancelled" }]} />
        </div>
        {result.items.length === 0 ? <EmptyState title="No sales" description="Create a sale and confirm it when the customer pays or the goods leave." /> : (
          <Table>
            <THead><tr><TH>Invoice</TH><TH>Customer</TH><TH>Date</TH><TH>Status</TH><TH>Payment</TH><TH>Total</TH></tr></THead>
            <tbody>
              {result.items.map((item) => (
                <TR key={item.id}>
                  <TD><Link className="font-medium hover:underline" href={`/sales/${item.id}`}>{item.invoiceNumber}</Link></TD>
                  <TD>{item.customerName}</TD>
                  <TD>{formatDate(item.date)}</TD>
                  <TD><Badge value={item.status} /></TD>
                  <TD><Badge value={item.paymentStatus} /></TD>
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
