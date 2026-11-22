import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { SettingsForms } from "@/components/settings/settings-forms";
import { getSettingsDto } from "@/server/guard";
import { getProfile, listAudit } from "@/server/services/system";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const canManage = session.user.permissions.includes("settings.manage");
  const [settings, profile, audit] = await Promise.all([
    getSettingsDto(),
    getProfile(),
    canManage ? listAudit(1) : Promise.resolve({ items: [] }),
  ]);
  if (!profile) redirect("/login");
  return (
    <div>
      <PageHeader title="Settings" description="Company details, tax, invoices, your profile, and the audit log." />
      <SettingsForms
        settings={settings}
        canManage={canManage}
        profile={{ name: profile.name, email: profile.email, phone: profile.phone, role: profile.role.name }}
        audit={audit.items}
      />
    </div>
  );
}
