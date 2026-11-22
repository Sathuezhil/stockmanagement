import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { OrderForm } from "@/components/orders/order-form";
import { getSettingsDto } from "@/server/guard";
import { listCustomers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function NewSalePage() {
  const session = await auth();
  if (!session?.user.permissions.includes("sales.manage")) redirect("/?error=forbidden");
  const [customers, settings] = await Promise.all([listCustomers(), getSettingsDto()]);
  return (
    <div>
      <PageHeader title="New sale" description="Drafts do not change stock. Confirmation checks availability and records the movement." />
      <OrderForm mode="sale" currency={settings.currency} taxRate={settings.taxEnabled ? settings.taxRate : 0} parties={customers} />
    </div>
  );
}
