import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { EntityManager } from "@/components/records/entity-manager";
import { Card } from "@/components/ui/card";
import { deleteBrandAction, saveBrandAction } from "@/server/actions/catalog";
import { listBrands } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("categories.manage")) redirect("/?error=forbidden");
  const brands = await listBrands();
  return (
    <div>
      <PageHeader title="Brands" description="Brands can be filtered on the product list." />
      <Card>
        <EntityManager
          items={brands}
          columns={[{ key: "name", label: "Name" }, { key: "description", label: "Description" }, { key: "productCount", label: "Products" }]}
          fields={[{ name: "name", label: "Name" }, { name: "description", label: "Description", textarea: true }]}
          onSave={saveBrandAction}
          onDelete={deleteBrandAction}
          addLabel="Add brand"
          empty="Add the brands you stock."
        />
      </Card>
    </div>
  );
}
