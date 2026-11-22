import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { PurchaseActions } from "@/components/orders/document-actions";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/print-button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { getSettingsDto } from "@/server/guard";
import { getPurchase } from "@/server/services/commerce";
import { listSuppliers } from "@/server/services/parties";
import { OrderForm } from "@/components/orders/order-form";

export const dynamic = "force-dynamic";

export default async function PurchaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user.permissions.includes("purchases.manage")) redirect("/?error=forbidden");
  const { id } = await params;
  const [purchase, settings, suppliers] = await Promise.all([getPurchase(id), getSettingsDto(), listSuppliers()]);
  if (!purchase) notFound();
  return (
    <div className="space-y-6">
      <PageHeader title={purchase.invoiceNumber} description={`${purchase.supplier.name} · ${purchase.date}`}>
        <Badge value={purchase.status} />
        <PurchaseActions id={purchase.id} status={purchase.status} />
        <PrintButton label="Print" />
      </PageHeader>
      <Card className="print-area">
        <CardContent>
          <div className="mb-6 flex justify-between gap-4">
            <div>
              <p className="text-lg font-semibold">{settings.companyName}</p>
              <p className="text-sm text-muted-foreground">{settings.address}</p>
            </div>
            <div className="text-right text-sm">
              <p>Invoice {purchase.invoiceNumber}</p>
              <p>Created by {purchase.createdBy}</p>
            </div>
          </div>
          <Table>
            <THead><tr><TH>Product</TH><TH>Qty</TH><TH>Unit price</TH><TH>Total</TH></tr></THead>
            <tbody>
              {purchase.items.map((item) => (
                <TR key={item.id}>
                  <TD>{item.name}<span className="block text-xs text-muted-foreground">{item.sku}</span></TD>
                  <TD>{item.quantity} {item.unit}</TD>
                  <TD>{formatMoney(item.unitPrice, settings.currency)}</TD>
                  <TD>{formatMoney(item.total, settings.currency)}</TD>
                </TR>
              ))}
            </tbody>
          </Table>
          <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(purchase.subtotal, settings.currency)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatMoney(purchase.taxAmount, settings.currency)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span>{formatMoney(purchase.total, settings.currency)}</span></div>
          </div>
          {settings.invoiceFooter ? <p className="mt-6 text-xs text-muted-foreground">{settings.invoiceFooter}</p> : null}
        </CardContent>
      </Card>
      {purchase.status === "PENDING" ? (
        <OrderForm
          mode="purchase"
          currency={settings.currency}
          taxRate={purchase.taxRate}
          parties={suppliers}
          initial={{
            id: purchase.id,
            partyId: purchase.supplierId,
            date: purchase.date,
            invoiceNumber: purchase.invoiceNumber,
            taxRate: purchase.taxRate,
            notes: purchase.notes,
            items: purchase.items.map((item) => ({ ...item, key: item.id, discount: 0, available: 0 })),
          }}
        />
      ) : null}
      <button className="no-print rounded-lg border border-border px-4 py-2 text-sm" type="button">Use the browser print dialog from this page to print the invoice.</button>
    </div>
  );
}
