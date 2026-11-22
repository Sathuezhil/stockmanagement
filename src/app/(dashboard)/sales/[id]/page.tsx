import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { OrderForm } from "@/components/orders/order-form";
import { SaleActions } from "@/components/orders/document-actions";
import { PrintButton } from "@/components/print-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { getSettingsDto } from "@/server/guard";
import { getSale } from "@/server/services/commerce";
import { listCustomers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function SaleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("sales.manage")) redirect("/?error=forbidden");
  const { id } = await params;
  const [sale, settings, customers] = await Promise.all([getSale(id), getSettingsDto(), listCustomers()]);
  if (!sale) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={sale.invoiceNumber} description={`${sale.customerName} · ${sale.date}`}>
        <Badge value={sale.status} />
        <Badge value={sale.paymentStatus} />
        <SaleActions id={sale.id} status={sale.status} paymentStatus={sale.paymentStatus} />
        <PrintButton />
      </PageHeader>
      <Card>
        <CardContent>
          <div className="mb-6 flex justify-between">
            <div>
              <p className="text-lg font-semibold">{settings.companyName}</p>
              <p className="text-sm text-muted-foreground">{settings.address}</p>
              <p className="mt-3 text-sm">Bill to {sale.customerName}</p>
              <p className="text-sm text-muted-foreground">{sale.customerPhone} {sale.customerEmail}</p>
            </div>
            <p className="text-sm">Prepared by {sale.createdBy}</p>
          </div>
          <Table>
            <THead><tr><TH>Product</TH><TH>Qty</TH><TH>Price</TH><TH>Discount</TH><TH>Total</TH></tr></THead>
            <tbody>
              {sale.items.map((item) => (
                <TR key={item.id}>
                  <TD>{item.name}<span className="block text-xs text-muted-foreground">{item.sku}</span></TD>
                  <TD>{item.quantity} {item.unit}</TD>
                  <TD>{formatMoney(item.unitPrice, settings.currency)}</TD>
                  <TD>{formatMoney(item.discount, settings.currency)}</TD>
                  <TD>{formatMoney(item.total, settings.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(sale.subtotal, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>{formatMoney(sale.discount, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatMoney(sale.taxAmount, settings.currency)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatMoney(sale.total, settings.currency)}</span></div>
          </div>
          {settings.invoiceFooter ? <p className="mt-6 text-xs text-muted-foreground">{settings.invoiceFooter}</p> : null}
        </CardContent>
      </Card>
      {sale.status === "DRAFT" ? (
        <OrderForm
          mode="sale"
          currency={settings.currency}
          taxRate={sale.taxRate}
          parties={customers}
          initial={{
            id: sale.id,
            partyId: sale.customerId,
            customerName: sale.customerName,
            customerPhone: sale.customerPhone,
            customerEmail: sale.customerEmail,
            date: sale.date,
            invoiceNumber: sale.invoiceNumber,
            taxRate: sale.taxRate,
            discount: sale.discount,
            paymentStatus: sale.paymentStatus,
            notes: sale.notes,
            items: sale.items.map((item) => ({ ...item, key: item.id, available: 0 })),
          }}
        />
      ) : null}
    </div>
  );
}
