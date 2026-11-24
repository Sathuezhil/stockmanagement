"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "@/components/theme-provider";
import { Bell, LogOut, Menu, Moon, Sun, UserRound } from "lucide-react";
import { SidebarNav } from "@/components/layout/sidebar";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/actions/auth";

export function AppShell({
  children,
  user,
  companyName,
  logo,
  unread,
}: {
  children: React.ReactNode;
  user: { name?: string | null; email?: string | null; roleName: string; permissions: string[] };
  companyName: string;
  logo?: string | null;
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <div className="min-h-screen">
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border lg:block">
        <SidebarNav permissions={user.permissions} companyName={companyName} logo={logo} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent>
          <SidebarNav permissions={user.permissions} companyName={companyName} logo={logo} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="app-content lg:pl-64">
        <header className="no-print sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-card/90 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
              <Menu />
            </Button>
            <p className="hidden text-sm text-muted-foreground sm:block">Operations workspace</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
              <Sun className="hidden dark:block" />
              <Moon className="dark:hidden" />
            </Button>
            <Button variant="ghost" size="icon" asChild className="relative" aria-label="Notifications">
              <Link href="/notifications">
                <Bell />
                {unread > 0 ? <span className="absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[10px] text-white">{unread > 9 ? "9+" : unread}</span> : null}
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="max-w-56">
                  <UserRound />
                  <span className="truncate">{user.name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  <span className="block text-sm text-foreground">{user.name}</span>
                  <span className="block text-xs">{user.roleName}</span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/settings">Profile and settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={(event) => { event.preventDefault(); void signOutAction(); }}>
                  <LogOut className="size-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
