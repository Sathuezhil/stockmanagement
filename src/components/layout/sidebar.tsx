"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  BarChart3,
  Folders,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Shield,
  ShoppingCart,
  Tags,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Products", icon: Package, permission: "products.view" },
  { href: "/categories", label: "Categories", icon: Folders, permission: "categories.manage" },
  { href: "/brands", label: "Brands", icon: Tags, permission: "categories.manage" },
  { href: "/stock", label: "Stock", icon: ArrowLeftRight, permission: "stock.manage" },
  { href: "/purchases", label: "Purchases", icon: ShoppingCart, permission: "purchases.manage" },
  { href: "/suppliers", label: "Suppliers", icon: Truck, permission: "suppliers.manage" },
  { href: "/sales", label: "Sales", icon: Receipt, permission: "sales.manage" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers.manage" },
  { href: "/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
  { href: "/users", label: "Users", icon: Shield, permission: "users.manage" },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function SidebarNav({
  permissions,
  companyName,
  onNavigate,
}: {
  permissions: string[];
  companyName: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const visible = items.filter((item) => !item.permission || permissions.includes(item.permission));
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex size-10 items-center justify-center rounded-xl bg-teal-500 text-slate-950">
          <Warehouse className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{companyName}</p>
          <p className="text-xs text-sidebar-muted">Inventory system</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
        {visible.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-sidebar-muted transition hover:bg-sidebar-accent hover:text-white",
                active && "bg-sidebar-accent text-white",
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
