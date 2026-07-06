import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, IndianRupee } from "lucide-react";
import { getExpiryDashboard } from "@/lib/api/expiry.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/expiry/")({
  component: ExpiryPage,
});

function ExpiryPage() {
  const { data, isLoading } = useQuery({ queryKey: ["expiry-dashboard"], queryFn: () => getExpiryDashboard() });

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading expiry dashboard…</div>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Expiry Management</h1>
          <p className="text-sm text-muted-foreground">Stay ahead of expiring stock and minimise write-offs.</p>
        </div>
        <Button variant="outline" onClick={() => window.print()}>
          Print Expiry Report
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard
          label="Expiring This Month"
          value={String(data.expiringThisMonthCount)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard label="Estimated Loss (30 days)" value={formatInr(data.totalEstimatedLoss)} icon={IndianRupee} tone="danger" />
        <StatCard label="Already Expired" value={String(data.expired.length)} icon={AlertTriangle} tone="danger" />
      </div>

      <Tabs defaultValue="30">
        <TabsList>
          {data.buckets.map((b) => (
            <TabsTrigger key={b.days} value={String(b.days)}>
              {b.days} Days ({b.items.length})
            </TabsTrigger>
          ))}
        </TabsList>
        {data.buckets.map((bucket) => (
          <TabsContent key={bucket.days} value={String(bucket.days)}>
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Medicine</TableHead>
                      <TableHead>Batch</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Expiry</TableHead>
                      <TableHead className="text-right">Days Left</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Est. Loss</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bucket.items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                          Nothing expiring in this window.
                        </TableCell>
                      </TableRow>
                    )}
                    {bucket.items.map((item) => (
                      <TableRow key={item.id} className={cn(item.daysToExpiry <= 7 && "bg-destructive/5")}>
                        <TableCell className="font-medium">{item.medicineName}</TableCell>
                        <TableCell>{item.batchNo}</TableCell>
                        <TableCell>{item.supplierName || "—"}</TableCell>
                        <TableCell>{formatDate(item.expiryDate)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={item.daysToExpiry <= 7 ? "destructive" : "secondary"}>
                            {item.daysToExpiry}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{item.quantity}</TableCell>
                        <TableCell className="text-right font-mono">{formatInr(item.estimatedLoss)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
