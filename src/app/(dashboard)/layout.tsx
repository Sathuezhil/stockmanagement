import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/app-shell";
import { prisma } from "@/lib/prisma";
import { getSettingsDto } from "@/server/guard";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [settings, unread] = await Promise.all([
    getSettingsDto(),
    prisma.notification.count({ where: { isRead: false } }),
  ]);
  return (
    <AppShell user={session.user} companyName={settings.companyName} logo={settings.logo} unread={unread}>
      {children}
    </AppShell>
  );
}
