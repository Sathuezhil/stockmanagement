"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/server/actions/system";
import { Button } from "@/components/ui/button";

export function NotificationButtons({ id }: { id?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => start(async () => {
        const result = id ? await markNotificationReadAction(id) : await markAllNotificationsReadAction();
        if (!result.ok) toast.error(result.error);
        else router.refresh();
      })}
    >
      {id ? "Mark read" : "Mark all read"}
    </Button>
  );
}
