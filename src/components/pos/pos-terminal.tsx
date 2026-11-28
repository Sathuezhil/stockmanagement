"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { findProductByBarcode, isBarcodeScan, isFastScan, noteScanKey, type BarcodeProduct } from "@/lib/barcode-scan";
import { formatMoney } from "@/lib/format";
import { money } from "@/lib/utils";
import { saveSaleAction } from "@/server/actions/operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select } from "@/components/ui/input";

type Customer = { id: string; name: string; phone?: string | null; email?: string | null };
type Line = {
  key: string;
  productId: string;
  name: string;
  sku: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  available: number;
};

export function PosTerminal({
  currency,
  taxName,
  taxRate,
  allowNegativeStock,
  customers,
}: {
  currency: string;
  taxName: string;
  taxRate: number;
  allowNegativeStock: boolean;
  customers: Customer[];
}) {
  const router = useRouter();
  const scanRef = useRef<HTMLInputElement>(null);
  const searchRequest = useRef(0);
  const scanTimes = useRef<number[]>([]);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BarcodeProduct[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in");
  const [customerPhone, setCustomerPhone] = useState("");
  const [discount, setDiscount] = useState(0);
  const [cash, setCash] = useState("");
  const [pending, setPending] = useState(false);

  const totals = useMemo(() => {
    const subtotal = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
    const afterDiscount = money(Math.max(0, subtotal - discount));
    const tax = money(afterDiscount * (taxRate / 100));
    return { subtotal, tax, total: money(afterDiscount + tax) };
  }, [lines, discount, taxRate]);

  const received = cash.trim() === "" ? totals.total : Number(cash);
  const change = Number.isFinite(received) ? money(received - totals.total) : 0;

  function focusScan() {
    scanRef.current?.focus();
  }

  function addProduct(hit: BarcodeProduct) {
    const existing = lines.find((line) => line.productId === hit.id);
    const nextQuantity = (existing?.quantity ?? 0) + 1;
    if (!allowNegativeStock && nextQuantity > hit.quantity) {
      toast.error(hit.quantity > 0 ? `Only ${hit.quantity} ${hit.unit} in stock` : `${hit.name} is out of stock`);
      setQuery("");
      setResults([]);
      window.setTimeout(focusScan, 0);
      return;
    }
    setLines((current) => {
      const currentLine = current.find((line) => line.productId === hit.id);
      if (currentLine) {
        return current.map((line) => line.productId === hit.id ? { ...line, quantity: line.quantity + 1, available: hit.quantity } : line);
      }
      return [
        ...current,
        {
          key: crypto.randomUUID(),
          productId: hit.id,
          name: hit.name,
          sku: hit.sku,
          unit: hit.unit,
          quantity: 1,
          unitPrice: hit.sellingPrice,
          available: hit.quantity,
        },
      ];
    });
    setQuery("");
    setResults([]);
    window.setTimeout(focusScan, 0);
  }

  async function search(value: string) {
    setQuery(value);
    const requestId = ++searchRequest.current;
    if (!value.trim()) {
      setResults([]);
      return;
    }
    const response = await fetch(`/api/products/search?q=${encodeURIComponent(value)}`);
    if (requestId !== searchRequest.current || !response.ok) return;
    setResults(await response.json());
  }

  async function scanBarcode(code: string) {
    searchRequest.current += 1;
    const hit = await findProductByBarcode(code);
    if (!hit) {
      setQuery("");
      setResults([]);
      toast.error("No product is saved with this barcode");
      focusScan();
      return;
    }
    addProduct(hit);
  }

  function setQuantity(key: string, quantity: number) {
    if (quantity <= 0) {
      setLines((current) => current.filter((line) => line.key !== key));
      return;
    }
    const line = lines.find((item) => item.key === key);
    if (!line) return;
    if (!allowNegativeStock && quantity > line.available) {
      toast.error(`Only ${line.available} ${line.unit} in stock`);
      return;
    }
    setLines((current) => current.map((item) => item.key === key ? { ...item, quantity } : item));
  }

  async function charge() {
    if (lines.length === 0) {
      toast.error("Add at least one product");
      return;
    }
    if (cash.trim() !== "" && (!Number.isFinite(received) || received < totals.total)) {
      toast.error("Amount received is less than the bill total");
      return;
    }
    const name = customerName.trim() || "Walk-in";
    setPending(true);
    const result = await saveSaleAction({
      customerId,
      customerName: name,
      customerPhone,
      customerEmail: "",
      date: new Date().toISOString().slice(0, 10),
      invoiceNumber: "",
      paymentStatus: "PAID",
      discount,
      taxRate,
      notes: cash.trim() === "" ? "" : `Cash received ${formatMoney(received, currency)}. Change ${formatMoney(Math.max(0, change), currency)}.`,
      items: lines.map((line) => ({ productId: line.productId, quantity: line.quantity, unitPrice: line.unitPrice, discount: 0 })),
    }, { confirm: true });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success("Bill saved");
    router.push(`/sales/${result.id}?print=1`);
    router.refresh();
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="space-y-4">
          <Field label="Scan or search">
            <Input
              ref={scanRef}
              autoFocus
              value={query}
              placeholder="Scan a barcode or type a product name"
              onChange={(event) => void search(event.target.value)}
              onKeyDown={(event) => {
                noteScanKey(scanTimes.current, event.key);
                const input = event.currentTarget;
                if (scanTimer.current) clearTimeout(scanTimer.current);
                if (event.key === "Enter") {
                  event.preventDefault();
                  const code = input.value.trim();
                  if (isBarcodeScan(code)) void scanBarcode(code);
                  else if (results[0]) addProduct(results[0]);
                  return;
                }
                scanTimer.current = setTimeout(() => {
                  const code = input.value.trim();
                  if (isBarcodeScan(code) && isFastScan(scanTimes.current)) void scanBarcode(code);
                }, 120);
              }}
            />
            {results.length > 0 ? (
              <div className="max-h-48 overflow-auto rounded-xl border border-border">
                {results.map((hit) => (
                  <button type="button" key={hit.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => addProduct(hit)}>
                    {hit.name} · {hit.sku} · {formatMoney(hit.sellingPrice, currency)} · {hit.quantity} {hit.unit}
                  </button>
                ))}
              </div>
            ) : null}
          </Field>
          {lines.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">The bill is empty. Scan a product to start.</p>
          ) : (
            <div className="space-y-3">
              {lines.map((line) => (
                <div key={line.key} className="grid items-center gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_auto_auto_auto]">
                  <div>
                    <p className="font-medium">{line.name}</p>
                    <p className="text-xs text-muted-foreground">{line.sku} · {formatMoney(line.unitPrice, currency)} · stock {line.available} {line.unit}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="outline" size="sm" onClick={() => setQuantity(line.key, line.quantity - 1)}>-</Button>
                    <Input className="w-20 text-center" type="number" min="1" step="1" value={line.quantity} onChange={(event) => setQuantity(line.key, Number(event.target.value))} />
                    <Button type="button" variant="outline" size="sm" onClick={() => setQuantity(line.key, line.quantity + 1)}>+</Button>
                  </div>
                  <p className="text-sm font-medium">{formatMoney(line.quantity * line.unitPrice, currency)}</p>
                  <Button type="button" variant="ghost" onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>Remove</Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Card className="h-fit">
        <CardContent className="space-y-3">
          <Field label="Customer">
            <Select value={customerId} onChange={(event) => {
              const id = event.target.value;
              setCustomerId(id);
              const customer = customers.find((item) => item.id === id);
              setCustomerName(customer?.name ?? "Walk-in");
              setCustomerPhone(customer?.phone ?? "");
            }}>
              <option value="">Walk-in</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </Select>
          </Field>
          <Field label="Name on bill">
            <Input value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
          </Field>
          <Field label="Bill discount">
            <Input type="number" min="0" step="0.01" value={discount} onChange={(event) => setDiscount(Number(event.target.value))} />
          </Field>
          <div className="space-y-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(totals.subtotal, currency)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span>{formatMoney(discount, currency)}</span></div>
            <div className="flex justify-between"><span>{taxName} {taxRate}%</span><span>{formatMoney(totals.tax, currency)}</span></div>
            <div className="flex justify-between text-lg font-semibold"><span>Total</span><span>{formatMoney(totals.total, currency)}</span></div>
          </div>
          <Field label="Cash received">
            <Input type="number" min="0" step="0.01" value={cash} placeholder={String(totals.total)} onChange={(event) => setCash(event.target.value)} />
          </Field>
          <div className="flex justify-between text-sm"><span>Change</span><span>{formatMoney(Math.max(0, change), currency)}</span></div>
          <Button className="w-full" disabled={pending || lines.length === 0} onClick={() => void charge()}>
            {pending ? "Saving bill..." : "Charge and print"}
          </Button>
          <Button type="button" variant="outline" className="w-full" disabled={pending} onClick={() => { setLines([]); setCash(""); setDiscount(0); focusScan(); }}>
            Clear bill
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
