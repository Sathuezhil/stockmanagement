"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { MAX_IMAGE_BYTES, UNITS } from "@/lib/constants";
import { productSchema, type ProductInput } from "@/lib/validators";
import { saveProductAction } from "@/server/actions/catalog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";

type Option = { id: string; name: string };

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

function sellingFromMarkup(purchase: number, markup: number) {
  return roundMoney(purchase * (1 + markup / 100));
}

function markupFromPrices(purchase: number, selling: number) {
  if (purchase <= 0) return 0;
  return roundMoney(((selling - purchase) / purchase) * 100);
}

function percentTextFromValue(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return String(value);
}

function parsePercent(raw: string) {
  const negative = raw.trim().startsWith("-");
  let body = raw.replace(/[^\d.]/g, "");
  const parts = body.split(".");
  if (parts.length > 1) body = `${parts[0]}.${parts.slice(1).join("")}`;
  body = body.replace(/^0+(?=\d)/, "");
  const text = body === "" ? (negative ? "-" : "") : `${negative ? "-" : ""}${body}`;
  const percent = body === "" || body === "." ? 0 : Number(text);
  return { text, percent: Number.isFinite(percent) ? percent : 0 };
}

export function ProductForm({
  categories,
  brands,
  suppliers,
  product,
}: {
  categories: Option[];
  brands: Option[];
  suppliers: Option[];
  product?: {
    id: string;
    name: string;
    sku: string;
    barcode: string | null;
    categoryId: string;
    brandId: string | null;
    supplierId: string | null;
    description: string | null;
    image: string | null;
    purchasePrice: number;
    sellingPrice: number;
    minStock: number;
    maxStock: number | null;
    unit: string;
    location: string | null;
    status: "ACTIVE" | "INACTIVE";
  };
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const initialMarkup = markupFromPrices(product?.purchasePrice ?? 0, product?.sellingPrice ?? 0);
  const [markup, setMarkup] = useState(initialMarkup);
  const [percentText, setPercentText] = useState(() => percentTextFromValue(initialMarkup));
  const form = useForm<ProductInput>({
    resolver: zodResolver(productSchema) as Resolver<ProductInput>,
    defaultValues: {
      name: product?.name ?? "",
      sku: product?.sku ?? "",
      barcode: product?.barcode ?? "",
      categoryId: product?.categoryId ?? categories[0]?.id ?? "",
      brandId: product?.brandId ?? "",
      supplierId: product?.supplierId ?? "",
      description: product?.description ?? "",
      image: product?.image ?? "",
      purchasePrice: product?.purchasePrice ?? 0,
      sellingPrice: product?.sellingPrice ?? 0,
      quantity: 0,
      minStock: product?.minStock ?? 0,
      maxStock: product?.maxStock ?? undefined,
      unit: product?.unit ?? "PCS",
      location: product?.location ?? "",
      status: product?.status ?? "ACTIVE",
    },
  });

  async function upload(file: File) {
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Images must be 50 MB or smaller");
      return;
    }
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    const response = await fetch("/api/upload", { method: "POST", body });
    const data = await response.json();
    setUploading(false);
    if (!response.ok) {
      toast.error(data.error ?? "Upload failed");
      return;
    }
    form.setValue("image", data.url);
  }

  async function onSubmit(values: ProductInput) {
    const result = await saveProductAction(values, product?.id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message);
    router.push(`/products/${result.id}`);
    router.refresh();
  }

  const image = form.watch("image");

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <Card>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name" error={form.formState.errors.name?.message} className="sm:col-span-2">
            <Input {...form.register("name")} />
          </Field>
          <Field label="SKU / product code" error={form.formState.errors.sku?.message}>
            <Input {...form.register("sku")} />
          </Field>
          <Field label="Barcode" error={form.formState.errors.barcode?.message}>
            <Input {...form.register("barcode")} />
          </Field>
          <Field label="Category" error={form.formState.errors.categoryId?.message}>
            <Select {...form.register("categoryId")}>
              <option value="">Select</option>
              {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Brand">
            <Select {...form.register("brandId")}>
              <option value="">None</option>
              {brands.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Supplier">
            <Select {...form.register("supplierId")}>
              <option value="">None</option>
              {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </Select>
          </Field>
          <Field label="Unit" error={form.formState.errors.unit?.message}>
            <Select {...form.register("unit")}>
              {UNITS.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
            </Select>
          </Field>
          <Field label="Purchase per price" error={form.formState.errors.purchasePrice?.message}>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("purchasePrice", {
                onChange: (event) => {
                  const purchase = Number(event.target.value);
                  form.setValue("sellingPrice", sellingFromMarkup(Number.isFinite(purchase) ? purchase : 0, markup), { shouldValidate: true });
                },
              })}
            />
          </Field>
          <Field label="Selling per price" error={form.formState.errors.sellingPrice?.message}>
            <Input
              type="number"
              step="0.01"
              min="0"
              {...form.register("sellingPrice", {
                onChange: (event) => {
                  const selling = Number(event.target.value);
                  const purchase = Number(form.getValues("purchasePrice"));
                  const next = markupFromPrices(Number.isFinite(purchase) ? purchase : 0, Number.isFinite(selling) ? selling : 0);
                  setMarkup(next);
                  setPercentText(percentTextFromValue(next));
                },
              })}
            />
          </Field>
          <Field label="Percentage" className="sm:col-span-2">
            <Input
              type="text"
              inputMode="decimal"
              value={percentText}
              onChange={(event) => {
                const { text, percent } = parsePercent(event.target.value);
                setPercentText(text);
                setMarkup(percent);
                const purchase = Number(form.getValues("purchasePrice"));
                form.setValue("sellingPrice", sellingFromMarkup(Number.isFinite(purchase) ? purchase : 0, percent), { shouldValidate: true });
              }}
            />
          </Field>
          {product ? null : (
            <Field label="Opening quantity" error={form.formState.errors.quantity?.message}>
              <Input type="number" step="0.001" min="0" {...form.register("quantity")} />
            </Field>
          )}
          <Field label="Minimum stock" error={form.formState.errors.minStock?.message}>
            <Input type="number" step="0.001" min="0" {...form.register("minStock")} />
          </Field>
          <Field label="Maximum stock" error={form.formState.errors.maxStock?.message}>
            <Input type="number" step="0.001" min="0" {...form.register("maxStock")} />
          </Field>
          <Field label="Storage location">
            <Input {...form.register("location")} />
          </Field>
          <Field label="Status">
            <Select {...form.register("status")}>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Textarea {...form.register("description")} />
          </Field>
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-3">
            <p className="text-sm font-medium">Product image</p>
            {image ? <img src={image} alt="" className="h-40 w-full rounded-xl object-cover" /> : <div className="flex h-40 items-center justify-center rounded-xl bg-muted text-sm text-muted-foreground">No image</div>}
            <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }} />
            <p className="text-xs text-muted-foreground">JPG, PNG, or WebP. Maximum 50 MB.</p>
            {uploading ? <p className="text-xs text-muted-foreground">Uploading...</p> : null}
          </CardContent>
        </Card>
        <Button className="w-full" disabled={form.formState.isSubmitting || uploading}>
          {form.formState.isSubmitting ? "Saving..." : product ? "Save changes" : "Create product"}
        </Button>
      </div>
    </form>
  );
}
