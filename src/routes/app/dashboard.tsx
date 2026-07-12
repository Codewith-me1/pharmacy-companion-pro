import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  IndianRupee,
  Truck,
  Wallet,
  AlertTriangle,
  PackageX,
  Clock,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getDashboardStats } from "@/lib/api/dashboard.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { StatCard } from "@/components/stat-card";
import { GlobalSearch } from "@/components/global-search";
import { AiChatbot } from "@/components/ai-chatbot";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => getDashboardStats(),
    refetchInterval: 30_000,
  });
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading dashboard…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      {(business?.aiAssistantEnabled ?? true) && <AiChatbot />}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Today's snapshot of your pharmacy.</p>
        </div>
        <GlobalSearch />
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Today's Sales"
          value={formatInr(data.todaysSales.total)}
          sub={`${data.todaysSales.count} bills`}
          icon={IndianRupee}
          tone="success"
        />
        <StatCard
          label="Today's Purchases"
          value={formatInr(data.todaysPurchases.total)}
          sub={`${data.todaysPurchases.count} invoices`}
          icon={Truck}
        />
        <StatCard label="Current Stock Value" value={formatInr(data.stockValue)} icon={Wallet} />
        <StatCard
          label="Low Stock Medicines"
          value={String(data.lowStockCount)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard label="Out of Stock" value={String(data.outOfStockCount)} icon={PackageX} tone="danger" />
        <StatCard
          label="Expiring (30 days)"
          value={String(data.expiringCount)}
          icon={Clock}
          tone="warning"
        />
        <StatCard label="Pending Payments" value={formatInr(data.pendingPayments)} icon={Wallet} tone="danger" />
        <StatCard label="Today's Profit" value={formatInr(data.todaysProfit)} icon={TrendingUp} tone="success" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm">Monthly Sales vs Purchases</CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={mergeMonthly(data.monthlySales, data.monthlyPurchases)}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => formatInr(v)} />
                <Bar dataKey="sales" fill="var(--color-primary)" radius={4} />
                <Bar dataKey="purchases" fill="var(--color-muted-foreground)" radius={4} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Trophy className="h-4 w-4" /> Top Selling (30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.topSelling.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center text-muted-foreground">
                      No sales yet
                    </TableCell>
                  </TableRow>
                )}
                {data.topSelling.map((row) => (
                  <TableRow key={row.medicineId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell className="text-right font-mono">{row.totalQty}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Profit Trend</CardTitle>
        </CardHeader>
        <CardContent className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.monthlyProfit}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip formatter={(v: number) => formatInr(v)} />
              <Line type="monotone" dataKey="profit" stroke="var(--color-primary)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

function mergeMonthly(
  sales: { month: string; total: number }[],
  purchases: { month: string; total: number }[],
) {
  const months = Array.from(new Set([...sales.map((s) => s.month), ...purchases.map((p) => p.month)])).sort();
  return months.map((month) => ({
    month,
    sales: sales.find((s) => s.month === month)?.total ?? 0,
    purchases: purchases.find((p) => p.month === month)?.total ?? 0,
  }));
}
