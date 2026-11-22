"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/auth";
import { isRedirectError } from "@/lib/errors";
import { loginSchema } from "@/lib/validators";

export async function loginAction(input: { email: string; password: string }) {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid credentials" };
  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/",
    });
    return { ok: true as const };
  } catch (error) {
    if (isRedirectError(error)) throw error;
    if (error instanceof AuthError) return { ok: false as const, error: "Invalid email or password." };
    throw error;
  }
}

export async function signOutAction() {
  await signOut({ redirectTo: "/login" });
}
