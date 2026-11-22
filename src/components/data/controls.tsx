"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/input";

export function SearchBox({ placeholder = "Search" }: { placeholder?: string }) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  const initial = params.get("q") ?? "";
  const [value, setValue] = useState(initial);

  useEffect(() => setValue(initial), [initial]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (value === initial) return;
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      next.delete("page");
      router.replace(`${pathname}?${next.toString()}`);
    }, 300);
    return () => clearTimeout(handle);
  }, [value, initial, params, pathname, router]);

  return <Input value={value} onChange={(event) => setValue(event.target.value)} placeholder={placeholder} className="max-w-sm" />;
}

export function QuerySelect({
  name,
  label,
  value,
  options,
  includeEmpty = true,
}: {
  name: string;
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  includeEmpty?: boolean;
}) {
  const params = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <Select
        value={value ?? ""}
        onChange={(event) => {
          const next = new URLSearchParams(params.toString());
          if (event.target.value) next.set(name, event.target.value);
          else next.delete(name);
          next.delete("page");
          router.push(`${pathname}?${next.toString()}`);
        }}
      >
        {includeEmpty ? <option value="">All</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
    </label>
  );
}

export function Pagination({
  page,
  pages,
  total,
  pageSize,
  params,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  params: Record<string, string | undefined>;
}) {
  function href(nextPage: number) {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value && key !== "page") search.set(key, value);
    });
    search.set("page", String(nextPage));
    return `?${search.toString()}`;
  }
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-muted-foreground">
      <span>
        Showing {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-2">
        <a className={`rounded-lg border border-border px-3 py-1.5 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-muted"}`} href={href(page - 1)}>
          Previous
        </a>
        <span>
          Page {page} of {pages}
        </span>
        <a className={`rounded-lg border border-border px-3 py-1.5 ${page >= pages ? "pointer-events-none opacity-40" : "hover:bg-muted"}`} href={href(page + 1)}>
          Next
        </a>
      </div>
    </div>
  );
}
