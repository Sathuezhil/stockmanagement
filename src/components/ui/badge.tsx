import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/format";

const tones: Record<string, string> = {
  ACTIVE: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  INACTIVE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  IN_STOCK: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  LOW_STOCK: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  OUT_OF_STOCK: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  PENDING: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  RECEIVED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  CONFIRMED: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  DRAFT: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  PAID: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  UNPAID: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  PARTIAL: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  SUPER_ADMIN: "bg-teal-50 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  ADMIN: "bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  MANAGER: "bg-violet-50 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  STAFF: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
};

export function Badge({ value, className }: { value: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[value] ?? "bg-muted text-muted-foreground", className)}>
      {titleCase(value)}
    </span>
  );
}
