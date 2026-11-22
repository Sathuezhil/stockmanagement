import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { PageHeader } from "@/components/data/page-header";
import { EmptyState } from "@/components/data/page-header";
import { NotificationButtons } from "@/components/notifications/notification-buttons";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const notifications = await prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div>
      <PageHeader title="Notifications" description="Low stock, sales, purchases, adjustments, and system activity.">
        <NotificationButtons />
      </PageHeader>
      <Card>
        {notifications.length === 0 ? <EmptyState title="No notifications" description="Alerts appear here when stock, purchases, or sales change." /> : (
          <ul className="divide-y divide-border">
            {notifications.map((item) => (
              <li key={item.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(item.createdAt)}{item.isRead ? " · Read" : " · Unread"}</p>
                  {item.link ? <Link href={item.link} className="text-sm text-primary">Open</Link> : null}
                </div>
                {item.isRead ? null : <NotificationButtons id={item.id} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
