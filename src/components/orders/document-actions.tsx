"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { cancelPurchaseAction, cancelSaleAction, confirmSaleAction, receivePurchaseAction, updatePaymentAction } from "@/server/actions/operations";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";

export function PurchaseActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (status === "CANCELLED") return null;
  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    start(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }
  return (
    <>
      {status === "PENDING" ? <Button disabled={pending} onClick={() => run(() => receivePurchaseAction(id))}>Mark received</Button> : null}
      <Button variant="outline" disabled={pending} onClick={() => run(() => cancelPurchaseAction(id))}>Cancel purchase</Button>
    </>
  );
}

export function SaleActions({ id, status, paymentStatus }: { id: string; status: string; paymentStatus: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  function run(action: () => Promise<{ ok: boolean; error?: string; message?: string }>) {
    start(async () => {
      const result = await action();
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message);
        router.refresh();
      }
    });
  }
  if (status === "CANCELLED") return null;
  return (
    <>
      {status === "DRAFT" ? <Button disabled={pending} onClick={() => run(() => confirmSaleAction(id))}>Confirm sale</Button> : null}
      <Select defaultValue={paymentStatus} onChange={(event) => run(() => updatePaymentAction(id, event.target.value as "UNPAID" | "PARTIAL" | "PAID"))}>
        <option value="UNPAID">Unpaid</option>
        <option value="PARTIAL">Partial</option>
        <option value="PAID">Paid</option>
      </Select>
      <Button variant="outline" disabled={pending} onClick={() => run(() => cancelSaleAction(id))}>Cancel sale</Button>
    </>
  );
}
