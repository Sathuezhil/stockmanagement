import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { UsersManager } from "@/components/users/users-manager";
import { Card } from "@/components/ui/card";
import { listUsers } from "@/server/services/system";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user.permissions.includes("users.manage")) redirect("/?error=forbidden");
  const users = await listUsers();
  return (
    <div>
      <PageHeader title="Users" description="Super Admin, Admin, Manager, and Staff each have a fixed permission set." />
      <Card className="p-2"><UsersManager users={users} /></Card>
    </div>
  );
}
