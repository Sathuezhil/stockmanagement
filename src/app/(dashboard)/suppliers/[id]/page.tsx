import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney } from "@/lib/format";
import { getSettingsDto } from "@/server/guard";
import { getSupplier } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function SupplierPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("suppliers.manage")) redirect("/?error=forbidden");
  const { id } = await params;
  const [supplier, settings] = await Promise.all([getSupplier(id), getSettingsDto()]);
  if (!supplier) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={supplier.name} description={supplier.companyName ?? "Supplier"} />
      <Card>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <p>Contact: {supplier.contactPerson || "—"}</p>
          <p>Phone: {supplier.phone || "—"}</p>
          <p>Email: {supplier.email || "—"}</p>
          <p>Address: {supplier.address || "—"}</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <h2 className="px-5 py-4 font-semibold">Purchase history</h2>
          <Table>
            <THead><tr><TH>Invoice</TH><TH>Date</TH><TH>Status</TH><TH>Total</TH></tr></THead>
            <tbody>
              {supplier.purchases.length === 0 ? <TR><TD colSpan={4}>No purchases yet.</TD></TR> : supplier.purchases.map((purchase) => (
                <TR key={purchase.id}>
                  <TD><Link className="font-medium hover:underline" href={`/purchases/${purchase.id}`}>{purchase.invoiceNumber}</Link></TD>
                  <TD>{formatDate(purchase.date)}</TD>
                  <TD><Badge value={purchase.status} /></TD>
                  <TD>{formatMoney(purchase.total, settings.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
