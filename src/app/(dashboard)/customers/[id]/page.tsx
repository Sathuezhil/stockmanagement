import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { getSettingsDto } from "@/server/guard";
import { getCustomer } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("customers.manage")) redirect("/?error=forbidden");
  const { id } = await params;
  const [customer, settings] = await Promise.all([getCustomer(id), getSettingsDto()]);
  if (!customer) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={customer.name} description={customer.phone || customer.email || "Customer"} />
      <Card><CardContent><p>Address: {customer.address || "—"}</p></CardContent></Card>
      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 py-4 font-semibold">Purchase history</h2>
          <Table>
            <THead><tr><TH>Invoice</TH><TH>Date</TH><TH>Status</TH><TH>Payment</TH><TH>Total</TH></tr></THead>
            <tbody>
              {customer.sales.length === 0 ? <TR><TD colSpan={5}>No sales yet.</TD></TR> : customer.sales.map((sale) => (
                <TR key={sale.id}>
                  <TD><Link className="font-medium hover:underline" href={`/sales/${sale.id}`}>{sale.invoiceNumber}</Link></TD>
                  <TD>{formatDate(sale.date)}</TD>
                  <TD><Badge value={sale.status} /></TD>
                  <TD><Badge value={sale.paymentStatus} /></TD>
                  <TD>{formatMoney(sale.total, settings.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
