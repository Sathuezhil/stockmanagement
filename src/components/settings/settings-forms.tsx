"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CURRENCIES, MAX_IMAGE_BYTES } from "@/lib/constants";
import { changePasswordAction, saveProfileAction, saveSettingsAction } from "@/server/actions/system";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

type Settings = {
  companyName: string;
  logo: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  currency: string;
  taxEnabled: boolean;
  taxName: string;
  taxRate: number;
  invoicePrefix: string;
  purchasePrefix: string;
  stockPrefix: string;
  lowStockThreshold: number;
  allowNegativeStock: boolean;
  invoiceFooter: string | null;
};

export function SettingsForms({
  settings,
  profile,
  canManage,
  audit,
}: {
  settings: Settings;
  profile: { name: string; email: string; phone: string | null; role: string };
  canManage: boolean;
  audit: { id: string; action: string; entity: string; user: string; createdAt: string }[];
}) {
  const [taxEnabled, setTaxEnabled] = useState(settings.taxEnabled);
  const [allowNegative, setAllowNegative] = useState(settings.allowNegativeStock);
  const router = useRouter();
  const [logo, setLogo] = useState(settings.logo ?? "");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      {canManage ? (
        <Card className="xl:col-span-2">
          <CardHeader><h2 className="font-semibold">Company, tax, and invoices</h2></CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              start(async () => {
                const result = await saveSettingsAction({
                  companyName: form.get("companyName"),
                  logo,
                  address: form.get("address"),
                  phone: form.get("phone"),
                  email: form.get("email"),
                  currency: form.get("currency"),
                  taxEnabled,
                  taxName: form.get("taxName"),
                  taxRate: form.get("taxRate"),
                  invoicePrefix: form.get("invoicePrefix"),
                  purchasePrefix: form.get("purchasePrefix"),
                  stockPrefix: form.get("stockPrefix"),
                  lowStockThreshold: form.get("lowStockThreshold"),
                  allowNegativeStock: allowNegative,
                  invoiceFooter: form.get("invoiceFooter"),
                });
                if (!result.ok) toast.error(result.error);
                else {
                  toast.success(result.message);
                  router.refresh();
                }
              });
            }}>
              <Field label="Company name"><Input name="companyName" defaultValue={settings.companyName} /></Field>
              <Field label="Currency">
                <Select name="currency" defaultValue={settings.currency}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</Select>
              </Field>
              <Field label="Phone"><Input name="phone" defaultValue={settings.phone ?? ""} /></Field>
              <Field label="Email"><Input name="email" defaultValue={settings.email ?? ""} /></Field>
              <Field label="Address" className="md:col-span-2"><Textarea name="address" defaultValue={settings.address ?? ""} /></Field>
              <Field label="Logo">
                <Input type="file" accept="image/png,image/jpeg,image/webp" onChange={async (event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  if (file.size > MAX_IMAGE_BYTES) {
                    toast.error("Images must be 50 MB or smaller");
                    return;
                  }
                  setUploadingLogo(true);
                  try {
                    const body = new FormData();
                    body.set("file", file);
                    const response = await fetch("/api/upload", { method: "POST", body });
                    const data = await response.json();
                    if (!response.ok) toast.error(data.error ?? "The logo could not be uploaded");
                    else setLogo(data.url);
                  } finally {
                    setUploadingLogo(false);
                  }
                }} />
                {logo ? <img src={logo} alt="" className="h-16 rounded-lg" /> : null}
              </Field>
              <Field label="Default low stock threshold"><Input name="lowStockThreshold" type="number" min="0" defaultValue={settings.lowStockThreshold} /></Field>
              <Field label="Tax name"><Input name="taxName" defaultValue={settings.taxName} /></Field>
              <Field label="Tax rate %"><Input name="taxRate" type="number" step="0.01" min="0" defaultValue={settings.taxRate} /></Field>
              <Field label="Invoice prefix"><Input name="invoicePrefix" defaultValue={settings.invoicePrefix} /></Field>
              <Field label="Purchase prefix"><Input name="purchasePrefix" defaultValue={settings.purchasePrefix} /></Field>
              <Field label="Stock prefix"><Input name="stockPrefix" defaultValue={settings.stockPrefix} /></Field>
              <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">Tax enabled<Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} /></label>
              <label className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">Allow negative stock<Switch checked={allowNegative} onCheckedChange={setAllowNegative} /></label>
              <Field label="Invoice footer" className="md:col-span-2"><Textarea name="invoiceFooter" defaultValue={settings.invoiceFooter ?? ""} /></Field>
              <Button disabled={pending || uploadingLogo}>{pending ? "Saving..." : uploadingLogo ? "Uploading logo..." : "Save settings"}</Button>
            </form>
          </CardContent>
        </Card>
      ) : null}
      <Card>
        <CardHeader><h2 className="font-semibold">Profile</h2></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await saveProfileAction({ name: form.get("name"), phone: form.get("phone") });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success(result.message);
                router.refresh();
              }
            });
          }}>
            <Field label="Name"><Input name="name" defaultValue={profile.name} /></Field>
            <Field label="Email"><Input value={profile.email} disabled /></Field>
            <Field label="Phone"><Input name="phone" defaultValue={profile.phone ?? ""} /></Field>
            <p className="text-sm text-muted-foreground">Role: {profile.role}</p>
            <Button disabled={pending}>Update profile</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><h2 className="font-semibold">Change password</h2></CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            start(async () => {
              const result = await changePasswordAction({
                currentPassword: form.get("currentPassword"),
                newPassword: form.get("newPassword"),
                confirmPassword: form.get("confirmPassword"),
              });
              if (!result.ok) toast.error(result.error);
              else {
                toast.success(result.message);
                event.currentTarget.reset();
              }
            });
          }}>
            <Field label="Current password"><Input name="currentPassword" type="password" /></Field>
            <Field label="New password"><Input name="newPassword" type="password" /></Field>
            <Field label="Confirm password"><Input name="confirmPassword" type="password" /></Field>
            <Button disabled={pending}>Change password</Button>
          </form>
        </CardContent>
      </Card>
      {canManage ? (
        <Card className="xl:col-span-2">
          <CardHeader><h2 className="font-semibold">Audit log</h2></CardHeader>
          <CardContent className="p-0">
            <Table>
              <THead><tr><TH>When</TH><TH>User</TH><TH>Action</TH><TH>Record</TH></tr></THead>
              <tbody>
                {audit.length === 0 ? <TR><TD colSpan={4}>No audit events yet.</TD></TR> : audit.map((row) => (
                  <TR key={row.id}><TD>{formatDateTime(row.createdAt)}</TD><TD>{row.user}</TD><TD>{row.action}</TD><TD>{row.entity}</TD></TR>
                ))}
              </tbody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
