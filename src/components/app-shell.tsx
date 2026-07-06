import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ScanLine,
  Package,
  Boxes,
  AlertTriangle,
  Truck,
  ShoppingCart,
  Receipt,
  Stethoscope,
  Users,
  BarChart3,
  Settings,
  Pill,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/app/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/purchases", label: "Purchase Entry", icon: ScanLine },
  { to: "/app/inventory", label: "Inventory", icon: Package },
  { to: "/app/stock", label: "Stock", icon: Boxes },
  { to: "/app/expiry", label: "Expiry", icon: AlertTriangle },
  { to: "/app/suppliers", label: "Suppliers", icon: Truck },
  { to: "/app/sales", label: "Sales / POS", icon: ShoppingCart },
  { to: "/app/billing", label: "Billing", icon: Receipt },
  { to: "/app/doctors", label: "Doctors", icon: Stethoscope },
  { to: "/app/customers", label: "Customers", icon: Users },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-card px-5">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </span>
          <span>MediOS</span>
        </div>
        <span className="text-sm text-muted-foreground">Smart Pharmacy OS</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <nav className="flex w-56 flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card p-3">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
