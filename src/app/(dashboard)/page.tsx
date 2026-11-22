import Link from "next/link";
import { AlertTriangle, Boxes, CircleDollarSign, Layers3, Package, PackageX } from "lucide-react";
import { DashboardCharts } from "@/components/dashboard/charts";
import { PageHeader } from "@/components/data/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDate, formatMoney, formatQty, titleCase } from "@/lib/format";
import { getSettingsDto } from "@/server/guard";
import { getDashboard } from "@/server/services/dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const [data, settings] = await Promise.all([getDashboard(), getSettingsDto()]);
  const cards = [
    { label: "Total products", value: data.products.toLocaleString(), icon: Package, tone: "bg-teal-50 text-teal-700" },
    { label: "Total stock quantity", value: formatQty(data.quantity), icon: Boxes, tone: "bg-sky-50 text-sky-700" },
    { label: "Total stock value", value: formatMoney(data.value, settings.currency), icon: CircleDollarSign, tone: "bg-emerald-50 text-emerald-700" },
    { label: "Low stock", value: data.low.toLocaleString(), icon: AlertTriangle, tone: "bg-amber-50 text-amber-700" },
    { label: "Out of stock", value: data.out.toLocaleString(), icon: PackageX, tone: "bg-rose-50 text-rose-700" },
    { label: "Categories", value: data.categories.toLocaleString(), icon: Layers3, tone: "bg-violet-50 text-violet-700" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Live inventory, purchasing, and sales activity." />
      {params.error === "forbidden" ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">You do not have access to that module.</div>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.label}>
              <CardContent className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.label}</p>
                  <p className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</p>
                </div>
                <div className={`rounded-xl p-2.5 ${card.tone}`}>
                  <Icon className="size-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>
      <DashboardCharts monthly={data.monthly} categories={data.categoriesChart} />
      <section className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">Recent stock activity</h2>
              <Link href="/stock" className="text-sm text-primary">View all</Link>
            </div>
            <Table>
              <THead><tr><TH>Product</TH><TH>Type</TH><TH>Qty</TH></tr></THead>
              <tbody>
                {data.movements.length === 0 ? <TR><TD colSpan={3}>No movements yet.</TD></TR> : data.movements.map((row) => (
                  <TR key={row.id}>
                    <TD><p className="font-medium">{row.product}</p><p className="text-xs text-muted-foreground">{row.referenceNumber}</p></TD>
                    <TD>{titleCase(row.type)}</TD>
                    <TD>{formatQty(row.quantity)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">Recent purchases</h2>
              <Link href="/purchases" className="text-sm text-primary">View all</Link>
            </div>
            <Table>
              <THead><tr><TH>Invoice</TH><TH>Status</TH><TH>Total</TH></tr></THead>
              <tbody>
                {data.purchases.length === 0 ? <TR><TD colSpan={3}>No purchases yet.</TD></TR> : data.purchases.map((row) => (
                  <TR key={row.id}>
                    <TD><Link href={`/purchases/${row.id}`} className="font-medium hover:underline">{row.invoiceNumber}</Link><p className="text-xs text-muted-foreground">{formatDate(row.date)}</p></TD>
                    <TD><Badge value={row.status} /></TD>
                    <TD>{formatMoney(row.total, settings.currency)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="font-semibold">Recent sales</h2>
              <Link href="/sales" className="text-sm text-primary">View all</Link>
            </div>
            <Table>
              <THead><tr><TH>Invoice</TH><TH>Status</TH><TH>Total</TH></tr></THead>
              <tbody>
                {data.sales.length === 0 ? <TR><TD colSpan={3}>No sales yet.</TD></TR> : data.sales.map((row) => (
                  <TR key={row.id}>
                    <TD><Link href={`/sales/${row.id}`} className="font-medium hover:underline">{row.invoiceNumber}</Link><p className="text-xs text-muted-foreground">{row.customer}</p></TD>
                    <TD><Badge value={row.status} /></TD>
                    <TD>{formatMoney(row.total, settings.currency)}</TD>
                  </TR>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
