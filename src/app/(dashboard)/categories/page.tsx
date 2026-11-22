import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { EntityManager } from "@/components/records/entity-manager";
import { Card } from "@/components/ui/card";
import { deleteCategoryAction, saveCategoryAction } from "@/server/actions/catalog";
import { listCategories } from "@/server/services/catalog";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("categories.manage")) redirect("/?error=forbidden");
  const categories = await listCategories();
  return (
    <div>
      <PageHeader title="Categories" description="Each category shows how many products it contains." />
      <Card>
        <EntityManager
          items={categories}
          columns={[{ key: "name", label: "Name" }, { key: "description", label: "Description" }, { key: "productCount", label: "Products" }]}
          fields={[{ name: "name", label: "Name" }, { name: "description", label: "Description", textarea: true }]}
          onSave={saveCategoryAction}
          onDelete={deleteCategoryAction}
          addLabel="Add category"
          empty="Create a category before adding products."
        />
      </Card>
    </div>
  );
}
