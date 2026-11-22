import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { EntityManager } from "@/components/records/entity-manager";
import { Card } from "@/components/ui/card";
import { deleteCustomerAction, saveCustomerAction } from "@/server/actions/operations";
import { listCustomers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("customers.manage")) redirect("/?error=forbidden");
  const customers = await listCustomers();
  return (
    <div>
      <PageHeader title="Customers" description="Customer records keep a link to their sales." />
      <Card>
        <EntityManager
          items={customers}
          columns={[{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "email", label: "Email" }, { key: "saleCount", label: "Sales" }]}
          fields={[{ name: "name", label: "Name" }, { name: "phone", label: "Phone" }, { name: "email", label: "Email" }, { name: "address", label: "Address", textarea: true }]}
          onSave={saveCustomerAction}
          onDelete={deleteCustomerAction}
          addLabel="Add customer"
          empty="Add a customer before linking a sale."
        />
        <div className="grid gap-2 px-4 pb-4 text-sm">
          {customers.map((customer) => <Link key={customer.id} className="text-primary hover:underline" href={`/customers/${customer.id}`}>{customer.name} purchase history</Link>)}
        </div>
      </Card>
    </div>
  );
}
