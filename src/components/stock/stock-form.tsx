"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { STOCK_TYPES } from "@/lib/constants";
import { recordStockAction } from "@/server/actions/operations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

type ProductHit = { id: string; name: string; sku: string; quantity: number; unit: string; location: string | null };

export function StockForm({ initialProductId }: { initialProductId?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductHit[]>([]);
  const [product, setProduct] = useState<ProductHit | null>(null);
  const [type, setType] = useState("STOCK_IN");
  const [pending, setPending] = useState(false);

  async function search(value: string) {
    setQuery(value);
    if (value.trim().length < 1) {
      setResults([]);
      return;
    }
    const response = await fetch(`/api/products/search?q=${encodeURIComponent(value)}`);
    if (response.ok) setResults(await response.json());
  }

  async function submit(formData: FormData) {
    if (!product && !initialProductId) {
      toast.error("Choose a product");
      return;
    }
    setPending(true);
    const result = await recordStockAction({
      productId: product?.id || initialProductId,
      type,
      quantity: formData.get("quantity"),
      toLocation: formData.get("toLocation"),
      notes: formData.get("notes"),
    });
    setPending(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.push("/stock");
    router.refresh();
  }

  const absolute = type === "ADJUSTMENT" || type === "OPENING";

  return (
    <Card>
      <CardContent>
        <form action={submit} className="grid max-w-2xl gap-4">
          <Field label="Product">
            <Input value={product ? `${product.name} (${product.sku})` : query} placeholder="Search by name, SKU, or barcode" onChange={(event) => { setProduct(null); void search(event.target.value); }} />
            {results.length > 0 && !product ? (
              <div className="rounded-xl border border-border bg-card">
                {results.map((item) => (
                  <button type="button" key={item.id} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setProduct(item); setResults([]); }}>
                    {item.name} · {item.sku} · {item.quantity} {item.unit}
                  </button>
                ))}
              </div>
            ) : null}
            {product ? <p className="text-xs text-muted-foreground">On hand: {product.quantity} {product.unit}{product.location ? ` · ${product.location}` : ""}</p> : null}
          </Field>
          <Field label="Transaction type">
            <Select value={type} onChange={(event) => setType(event.target.value)}>
              {STOCK_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
          </Field>
          <Field label={absolute ? "New quantity" : "Quantity"}>
            <Input name="quantity" type="number" min="0" step="0.001" defaultValue="1" />
          </Field>
          {type === "TRANSFER" ? (
            <Field label="Destination location">
              <Input name="toLocation" placeholder="Rack, bin, or warehouse" />
            </Field>
          ) : null}
          <Field label="Notes">
            <Textarea name="notes" />
          </Field>
          <Button disabled={pending}>{pending ? "Saving..." : "Record movement"}</Button>
        </form>
      </CardContent>
    </Card>
  );
}
