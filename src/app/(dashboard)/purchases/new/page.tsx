import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { OrderForm } from "@/components/orders/order-form";
import { getSettingsDto } from "@/server/guard";
import { listSuppliers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const session = await auth();
  if (!session?.user.permissions.includes("purchases.manage")) redirect("/?error=forbidden");
  const [suppliers, settings] = await Promise.all([listSuppliers(), getSettingsDto()]);
  return (
    <div>
      <PageHeader title="New purchase" description="Add several products. Stock increases only when the purchase is received." />
      <OrderForm mode="purchase" currency={settings.currency} taxRate={settings.taxEnabled ? settings.taxRate : 0} parties={suppliers} />
    </div>
  );
}
