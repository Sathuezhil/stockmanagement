import { Prisma } from "@prisma/client";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export type ActionResult<T extends Record<string, unknown> = Record<string, never>> =
  | ({ ok: true; message?: string } & T)
  | { ok: false; error: string };

export function isRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

export function toActionError(error: unknown): { ok: false; error: string } {
  if (isRedirectError(error)) throw error;
  if (error instanceof AppError) return { ok: false, error: error.message };
  if (error instanceof ZodError) return { ok: false, error: error.issues[0]?.message ?? "Check the form and try again." };
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = Array.isArray(error.meta?.target) ? error.meta.target.join(", ") : "value";
    return { ok: false, error: `That ${target} is already in use.` };
  }
  console.error(error);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function runAction<T extends Record<string, unknown>>(
  fn: () => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    return toActionError(error) as ActionResult<T>;
  }
}
