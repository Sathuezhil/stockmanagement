"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/errors";
import { passwordSchema, profileSchema, settingsSchema, userSchema } from "@/lib/validators";
import { changePassword, saveUser, updateProfile, updateSettings } from "@/server/services/system";
import { prisma } from "@/lib/prisma";
import { assertPermission } from "@/server/guard";
import { PERMISSIONS } from "@/lib/permissions";

export async function saveUserAction(input: unknown, id?: string) {
  return runAction(async () => {
    const userId = await saveUser(userSchema.parse(input), id);
    revalidatePath("/users");
    return { ok: true as const, id: userId, message: "User saved" };
  });
}

export async function saveSettingsAction(input: unknown) {
  return runAction(async () => {
    await updateSettings(settingsSchema.parse(input));
    revalidatePath("/", "layout");
    return { ok: true as const, message: "Settings saved" };
  });
}

export async function saveProfileAction(input: unknown) {
  return runAction(async () => {
    await updateProfile(profileSchema.parse(input));
    revalidatePath("/settings");
    return { ok: true as const, message: "Profile updated" };
  });
}

export async function changePasswordAction(input: unknown) {
  return runAction(async () => {
    await changePassword(passwordSchema.parse(input));
    return { ok: true as const, message: "Password changed" };
  });
}

export async function markNotificationReadAction(id: string) {
  return runAction(async () => {
    await assertPermission(PERMISSIONS.PRODUCTS_VIEW);
    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true as const };
  });
}

export async function markAllNotificationsReadAction() {
  return runAction(async () => {
    await assertPermission(PERMISSIONS.PRODUCTS_VIEW);
    await prisma.notification.updateMany({ where: { isRead: false }, data: { isRead: true } });
    revalidatePath("/notifications");
    revalidatePath("/", "layout");
    return { ok: true as const, message: "All notifications marked as read" };
  });
}
