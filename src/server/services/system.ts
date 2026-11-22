import bcrypt from "bcryptjs";
import { UserRole } from "@prisma/client";
import { PERMISSIONS } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { emptyToNull } from "@/lib/utils";
import type { PasswordInput, ProfileInput, SettingsInput, UserInput } from "@/lib/validators";
import { notify, writeAudit } from "@/server/activity";
import { assertPermission, getCurrentUser, getSettings } from "@/server/guard";
import { AppError } from "@/lib/errors";

export async function listUsers() {
  await assertPermission(PERMISSIONS.USERS_MANAGE);
  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
    include: { role: true },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role.key,
    roleName: user.role.name,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
  }));
}

export async function saveUser(input: UserInput, id?: string) {
  const actor = await assertPermission(PERMISSIONS.USERS_MANAGE);
  const email = input.email.trim().toLowerCase();
  const duplicate = await prisma.user.findFirst({
    where: { email, NOT: id ? { id } : undefined },
  });
  if (duplicate) throw new AppError("A user with this email already exists.");
  if (!id && !input.password) throw new AppError("A password is required for a new user.");
  const role = await prisma.role.findUnique({ where: { key: input.role as UserRole } });
  if (!role) throw new AppError("That role is not available.");

  if (id && input.role !== "SUPER_ADMIN") {
    const current = await prisma.user.findUnique({ where: { id }, include: { role: true } });
    if (current?.role.key === "SUPER_ADMIN") {
      const remaining = await prisma.user.count({ where: { isActive: true, role: { key: "SUPER_ADMIN" }, NOT: { id } } });
      if (remaining === 0) throw new AppError("At least one active super admin is required.");
    }
  }

  const data = {
    name: input.name.trim(),
    email,
    phone: emptyToNull(input.phone),
    roleId: role.id,
    isActive: input.isActive,
    ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 12) } : {}),
  };
  const saved = id ? await prisma.user.update({ where: { id }, data }) : await prisma.user.create({ data: { ...data, passwordHash: data.passwordHash! } });
  await writeAudit(prisma, { userId: actor.id, action: id ? "UPDATE" : "CREATE", entity: "User", entityId: saved.id });
  await notify(prisma, {
    type: "SYSTEM",
    title: id ? "User updated" : "User created",
    message: `${saved.name} (${saved.email}) was ${id ? "updated" : "added"}.`,
    link: "/users",
  });
  return saved.id;
}

export async function updateProfile(input: ProfileInput) {
  const user = await getCurrentUser();
  if (!user) throw new AppError("You must be signed in.");
  await prisma.user.update({
    where: { id: user.id },
    data: { name: input.name.trim(), phone: emptyToNull(input.phone) },
  });
}

export async function changePassword(input: PasswordInput) {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) throw new AppError("You must be signed in.");
  const user = await prisma.user.findUnique({ where: { id: sessionUser.id } });
  if (!user) throw new AppError("User not found.");
  const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
  if (!valid) throw new AppError("Current password is incorrect.");
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(input.newPassword, 12) },
  });
  await writeAudit(prisma, { userId: user.id, action: "PASSWORD", entity: "User", entityId: user.id });
}

export async function updateSettings(input: SettingsInput) {
  const user = await assertPermission(PERMISSIONS.SETTINGS_MANAGE);
  if (input.allowNegativeStock && user.role !== "SUPER_ADMIN" && user.role !== "ADMIN") {
    throw new AppError("Only an administrator can allow negative stock.");
  }
  await prisma.companySettings.upsert({
    where: { id: "default" },
    update: {
      companyName: input.companyName.trim(),
      logo: emptyToNull(input.logo),
      address: emptyToNull(input.address),
      phone: emptyToNull(input.phone),
      email: emptyToNull(input.email)?.toLowerCase() ?? null,
      currency: input.currency,
      taxEnabled: input.taxEnabled,
      taxName: input.taxName.trim(),
      taxRate: input.taxRate,
      invoicePrefix: input.invoicePrefix.trim().toUpperCase(),
      purchasePrefix: input.purchasePrefix.trim().toUpperCase(),
      stockPrefix: input.stockPrefix.trim().toUpperCase(),
      lowStockThreshold: input.lowStockThreshold,
      allowNegativeStock: input.allowNegativeStock,
      invoiceFooter: emptyToNull(input.invoiceFooter),
    },
    create: { id: "default", companyName: input.companyName.trim() },
  });
  await writeAudit(prisma, { userId: user.id, action: "UPDATE", entity: "CompanySettings", entityId: "default" });
  await notify(prisma, { type: "SYSTEM", title: "Settings updated", message: "Company settings were updated.", link: "/settings" });
}

export async function getProfile() {
  const sessionUser = await getCurrentUser();
  if (!sessionUser) return null;
  return prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, name: true, email: true, phone: true, image: true, role: { select: { name: true, key: true } } },
  });
}

export async function listAudit(page = 1) {
  await assertPermission(PERMISSIONS.SETTINGS_MANAGE);
  const pageSize = 50;
  const [total, rows] = await prisma.$transaction([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { user: { select: { name: true } } },
    }),
  ]);
  return {
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    items: rows.map((row) => ({
      id: row.id,
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      user: row.user?.name ?? "System",
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export { getSettings };
