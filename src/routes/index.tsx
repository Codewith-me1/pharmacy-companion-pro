import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bot,
  Boxes,
  Pill,
  Receipt,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
} from "lucide-react";
import { getCurrentUser } from "@/lib/api/auth.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MediOS — Smart Pharmacy OS for India" },
      { name: "description", content: "MediOS is a smart pharmacy management system for Indian medical shops — billing, stock, expiry, doctors and GST reports in one place." },
      { property: "og:title", content: "MediOS — Smart Pharmacy OS for India" },
      { property: "og:description", content: "Smart Pharmacy OS for India — billing, stock, expiry and GST in one app." },
    ],
  }),
  component: HomePage,
});

const FEATURES = [
  { icon: ScanLine, title: "AI Purchase Entry", description: "Photograph a supplier invoice and let AI extract every line item — batch, expiry, GST, pricing — automatically." },
  { icon: ShoppingCart, title: "Sales / POS", description: "Fast, batch-aware billing with editable GST, customer credit, and instant bill printing." },
  { icon: Boxes, title: "Inventory & Stock", description: "Full medicine master, batch tracking, low-stock alerts and out-of-stock visibility." },
  { icon: Receipt, title: "Expiry Tracking", description: "Never get caught out by expiring stock — bucketed alerts by 7/15/30/60/90 days with estimated loss." },
  { icon: BarChart3, title: "GST & Business Reports", description: "Sales, purchase, profit & loss, GST input/output and category-wise reports, ready when you need them." },
  { icon: Bot, title: "AI Assistant", description: "Ask your dashboard questions in plain language — stock, expiry, sales, profit — answered from your real data." },
];

function HomePage() {
  const { data: user } = useQuery({ queryKey: ["current-user"], queryFn: () => getCurrentUser() });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Pill className="h-4 w-4" />
          </span>
          <span>MediOS</span>
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <Button asChild>
              <Link to="/app/dashboard">Go to Dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost">
                <Link to="/login">Log in</Link>
              </Button>
              <Button asChild>
                <Link to="/signup">Get Started Free</Link>
              </Button>
            </>
          )}
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-20 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Your pharmacy's data stays private to your account
          </span>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            The Smart Pharmacy OS built for Indian medical shops
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
            Billing, inventory, expiry tracking, doctors, suppliers, GST reports and an AI assistant — everything a
            pharmacy needs, in one place. Sign up and start running your shop in minutes.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={user ? "/app/dashboard" : "/signup"}>{user ? "Go to Dashboard" : "Get Started Free"}</Link>
            </Button>
            {!user && (
              <Button asChild size="lg" variant="outline">
                <Link to="/login">Log in</Link>
              </Button>
            )}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title}>
                <CardContent className="flex flex-col gap-3 p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <f.icon className="h-5 w-5" />
                  </span>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground">
        MediOS — Smart Pharmacy OS for India.
      </footer>
    </div>
  );
}
