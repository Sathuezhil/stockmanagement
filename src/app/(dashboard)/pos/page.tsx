import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { getSettingsDto } from "@/server/guard";
import { listCustomers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("sales.manage")) redirect("/?error=forbidden");
  const [customers, settings] = await Promise.all([listCustomers(), getSettingsDto()]);
  return (
    <div>
      <PageHeader title="POS" description="Scan a barcode or search a product, then charge the bill and print it." />
      <PosTerminal
        currency={settings.currency}
        taxName={settings.taxName}
        taxRate={settings.taxEnabled ? settings.taxRate : 0}
        allowNegativeStock={settings.allowNegativeStock}
        customers={customers.map((customer) => ({ id: customer.id, name: customer.name, phone: customer.phone, email: customer.email }))}
      />
    </div>
  );
}
