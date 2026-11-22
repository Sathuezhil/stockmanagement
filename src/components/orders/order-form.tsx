"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { money } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { savePurchaseAction, saveSaleAction } from "@/server/actions/operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

type Option = { id: string; name: string; phone?: string | null; email?: string | null };
type Hit = { id: string; name: string; sku: string; quantity: number; unit: string; sellingPrice: number; purchasePrice: number };
type Line = { key: string; productId: string; name: string; sku: string; quantity: number; unitPrice: number; discount: number; available: number; unit: string };

export function OrderForm({
  mode,
  currency,
  taxRate,
  parties,
  initial,
}: {
  mode: "purchase" | "sale";
  currency: string;
  taxRate: number;
  parties: Option[];
  initial?: {
    id: string;
    partyId?: string | null;
    customerName?: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    date: string;
    invoiceNumber: string;
    taxRate: number;
    discount?: number;
    paymentStatus?: "UNPAID" | "PARTIAL" | "PAID";
    notes?: string | null;
    items: Line[];
  };
}) {
  const router = useRouter();
  const [partyId, setPartyId] = useState(initial?.partyId ?? "");
  const [customerName, setCustomerName] = useState(initial?.customerName ?? "");
  const [customerPhone, setCustomerPhone] = useState(initial?.customerPhone ?? "");
  const [customerEmail, setCustomerEmail] = useState(initial?.customerEmail ?? "");
  const [paymentStatus, setPaymentStatus] = useState(initial?.paymentStatus ?? "UNPAID");
  const [discount, setDiscount] = useState(initial?.discount ?? 0);
  const [rate, setRate] = useState(initial?.taxRate ?? taxRate);
  const [lines, setLines] = useState<Line[]>(initial?.items ?? []);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Hit[]>([]);
  const [pending, setPending] = useState(false);

  const totals = useMemo(() => {
    const subtotal = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice - (mode === "sale" ? line.discount : 0), 0));
    const afterDiscount = money(Math.max(0, subtotal - (mode === "sale" ? discount : 0)));
    const tax = money(afterDiscount * (Number(rate) / 100));
    return { subtotal, tax, total: money(afterDiscount + tax) };
  }, [lines, discount, rate, mode]);

  async function search(value: string) {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const response = await fetch(`/api/products/search?q=${encodeURIComponent(value)}`);
    if (response.ok) setResults(await response.json());
  }

  function addProduct(hit: Hit) {
    setLines((current) => [
      ...current,
      {
        key: crypto.randomUUID(),
        productId: hit.id,
        name: hit.name,
        sku: hit.sku,
        quantity: 1,
        unitPrice: mode === "purchase" ? hit.purchasePrice : hit.sellingPrice,
        discount: 0,
        available: hit.quantity,
        unit: hit.unit,
      },
    ]);
    setQuery("");
    setResults([]);
  }

  async function submit(receiveOrConfirm: boolean) {
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    const date = (document.getElementById("order-date") as HTMLInputElement | null)?.value ?? "";
    const invoiceNumber = (document.getElementById("order-invoice") as HTMLInputElement | null)?.value ?? "";
    const notes = (document.getElementById("order-notes") as HTMLTextAreaElement | null)?.value ?? "";
    const payload = {
      date,
      invoiceNumber,
      taxRate: rate,
      notes,
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, discount: line.discount })),
    };
    setPending(true);
    const result = mode === "purchase"
      ? await savePurchaseAction({ ...payload, supplierId: partyId }, { id: initial?.id, receive: receiveOrConfirm })
      : await saveSaleAction({
          ...payload,
          customerId: partyId,
          customerName,
          customerPhone,
          customerEmail,
          discount,
          paymentStatus,
        }, { id: initial?.id, confirm: receiveOrConfirm });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.push(mode === "purchase" ? `/purchases/${result.id}` : `/sales/${result.id}`);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {mode === "purchase" ? (
              <Field label="Supplier">
                <Select value={partyId} onChange={(event) => setPartyId(event.target.value)}>
                  <option value="">Select</option>
                  {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
                </Select>
              </Field>
            ) : (
              <Field label="Saved customer">
                <Select value={partyId} onChange={(event) => {
                  const id = event.target.value;
                  setPartyId(id);
                  const party = parties.find((item) => item.id === id);
                  if (party) {
                    setCustomerName(party.name);
                    setCustomerPhone(party.phone ?? "");
                    setCustomerEmail(party.email ?? "");
                  }
                }}>
                  <option value="">Walk-in / new</option>
                  {parties.map((party) => <option key={party.id} value={party.id}>{party.name}</option>)}
                </Select>
              </Field>
            )}
            <Field label="Date">
              <Input id="order-date" type="date" defaultValue={initial?.date ?? new Date().toISOString().slice(0, 10)} />
            </Field>
            <Field label="Invoice number">
              <Input id="order-invoice" defaultValue={initial?.invoiceNumber ?? ""} placeholder="Leave blank to generate" />
            </Field>
            <Field label="Tax rate %">
              <Input type="number" min="0" step="0.01" value={rate} onChange={(event) => setRate(Number(event.target.value))} />
            </Field>
            {mode === "sale" ? (
              <>
                <Field label="Customer name"><Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} /></Field>
                <Field label="Phone"><Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} /></Field>
                <Field label="Email"><Input value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} /></Field>
                <Field label="Payment">
                  <Select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "UNPAID" | "PARTIAL" | "PAID")}>
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIAL">Partial</option>
                    <option value="PAID">Paid</option>
                  </Select>
                </Field>
                <Field label="Order discount"><Input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} /></Field>
              </>
            ) : null}
          </div>
          <Field label="Add product">
            <Input value={query} placeholder="Search name, SKU, or barcode" onChange={(event) => void search(event.target.value)} />
            {results.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-xl border border-border">
                {results.map((hit) => (
                  <button type="button" key={hit.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => addProduct(hit)}>
                    {hit.name} · {hit.sku} · available {hit.quantity} {hit.unit}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
          <div className="space-y-3">
            {lines.map((line) => (
              <div key={line.key} className="grid gap-2 rounded-xl border border-border p-3 md:grid-cols-[1.4fr_repeat(3,0.7fr)_auto]">
                <div>
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-muted-foreground">{line.sku} · available {line.available} {line.unit}</p>
                </div>
                <Input type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, quantity: Number(event.target.value) } : item))} />
                <Input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, unitPrice: Number(event.target.value) } : item))} />
                {mode === "sale" ? <Input type="number" min="0" step="0.01" value={line.discount} onChange={(event) => setLines((current) => current.map((item) => item.key === line.key ? { ...item, discount: Number(event.target.value) } : item))} /> : <div />}
                <Button type="button" variant="ghost" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove</Button>
              </div>
            ))}
          </div>
          <Field label="Notes"><Textarea id="order-notes" defaultValue={initial?.notes ?? ""} /></Field>
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatMoney(totals.subtotal, currency)}</span></div>
          {mode === "sale" ? <div className="flex justify-between text-sm"><span>Discount</span><span>{formatMoney(discount, currency)}</span></div> : null}
          <div className="flex justify-between text-sm"><span>Tax</span><span>{formatMoney(totals.tax, currency)}</span></div>
          <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatMoney(totals.total, currency)}</span></div>
          <Button className="w-full" variant="outline" disabled={pending} onClick={() => void submit(false)}>{pending ? "Saving..." : mode === "purchase" ? "Save as pending" : "Save draft"}</Button>
          <Button className="w-full" disabled={pending} onClick={() => void submit(true)}>{mode === "purchase" ? "Save and receive" : "Confirm and deduct stock"}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
