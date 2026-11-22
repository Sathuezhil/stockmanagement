import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { EntityManager } from "@/components/records/entity-manager";
import { Card } from "@/components/ui/card";
import { deleteSupplierAction, saveSupplierAction } from "@/server/actions/operations";
import { listSuppliers } from "@/server/services/parties";

export const dynamic = "force-dynamic";

export default async function SuppliersPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("suppliers.manage")) redirect("/?error=forbidden");
  const suppliers = await listSuppliers();
  return (
    <div>
      <PageHeader title="Suppliers" description="Open a supplier to see their purchase history." />
      <Card>
        <EntityManager
          items={suppliers.map((supplier) => ({ ...supplier, history: supplier.id }))}
          columns={[
            { key: "name", label: "Name" },
            { key: "companyName", label: "Company" },
            { key: "phone", label: "Phone" },
            { key: "email", label: "Email" },
            { key: "purchaseCount", label: "Purchases" },
          ]}
          fields={[
            { name: "name", label: "Supplier name" },
            { name: "companyName", label: "Company name" },
            { name: "contactPerson", label: "Contact person" },
            { name: "phone", label: "Phone" },
            { name: "email", label: "Email" },
            { name: "address", label: "Address", textarea: true },
          ]}
          onSave={saveSupplierAction}
          onDelete={deleteSupplierAction}
          addLabel="Add supplier"
          empty="Add the companies you buy from."
        />
        <div className="grid gap-2 px-4 pb-4 text-sm">
          {suppliers.map((supplier) => (
            <Link key={supplier.id} href={`/suppliers/${supplier.id}`} className="text-primary hover:underline">{supplier.name} purchase history</Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
