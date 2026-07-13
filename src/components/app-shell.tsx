import { useState } from "react";
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
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

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

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.to || pathname.startsWith(`${item.to}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
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
    </>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card px-3 sm:px-5">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </span>
          <span>MediOS</span>
        </div>
        <span className="hidden text-sm text-muted-foreground sm:inline">Smart Pharmacy OS</span>
        <div className="flex-1" />
        <span className="text-xs text-muted-foreground">
          {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
        </span>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <nav className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto border-r border-border bg-card p-3 md:flex">
          <NavLinks pathname={pathname} />
        </nav>
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="flex w-64 flex-col gap-1 p-3">
            <SheetHeader className="mb-2 px-1">
              <SheetTitle className="flex items-center gap-2 text-base">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Pill className="h-3.5 w-3.5" />
                </span>
                MediOS
              </SheetTitle>
            </SheetHeader>
            <NavLinks pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
          </SheetContent>
        </Sheet>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
