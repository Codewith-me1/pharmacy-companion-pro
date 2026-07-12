import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Download, IndianRupee, Search, Truck } from "lucide-react";
import { getExpiryDashboard } from "@/lib/api/expiry.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { printSupplierReturnReport } from "@/lib/print-supplier-report";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/expiry/")({
  component: ExpiryPage,
});

function useExpiryData() {
  return useQuery({ queryKey: ["expiry-dashboard"], queryFn: () => getExpiryDashboard() });
}

function matchesSearch(row: { medicineName: string; batchNo: string; supplierName: string | null }, search: string) {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    row.medicineName.toLowerCase().includes(term) ||
    row.batchNo.toLowerCase().includes(term) ||
    (row.supplierName ?? "").toLowerCase().includes(term)
  );
}

function ExpiryPage() {
  const { data, isLoading } = useExpiryData();
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });
  const [search, setSearch] = useState("");

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading expiry dashboard…</div>;
  }

  const filteredBySupplier = data.bySupplier
    .map((s) => ({ ...s, items: s.items.filter((i) => matchesSearch(i, search)) }))
    .filter((s) => s.items.length > 0);

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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by medicine, batch, or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="30">
        <TabsList className="flex-wrap">
          {data.buckets.map((b) => (
            <TabsTrigger key={b.days} value={String(b.days)}>
              {b.days} Days ({b.items.filter((i) => matchesSearch(i, search)).length})
            </TabsTrigger>
          ))}
          <TabsTrigger value="supplier">By Supplier ({filteredBySupplier.length})</TabsTrigger>
        </TabsList>
        {data.buckets.map((bucket) => {
          const items = bucket.items.filter((i) => matchesSearch(i, search));
          return (
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
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                            Nothing expiring in this window.
                          </TableCell>
                        </TableRow>
                      )}
                      {items.map((item) => (
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
          );
        })}

        <TabsContent value="supplier">
          <div className="flex flex-col gap-4">
            {filteredBySupplier.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No expiring stock matches this search, grouped by supplier.
                </CardContent>
              </Card>
            )}
            {filteredBySupplier.map((supplier) => (
              <Card key={supplier.supplierId ?? "unknown"}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      {supplier.supplierName}
                      <Badge variant="secondary">{supplier.items.length} expiring</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">Est. loss {formatInr(supplier.estimatedLoss)}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          printSupplierReturnReport({
                            firmName: business?.firmName,
                            dlNo: business?.dlNo,
                            mobile: business?.mobile,
                            supplierName: supplier.supplierName,
                            items: supplier.items.map((i) => ({
                              medicineName: i.medicineName,
                              pack: i.pack,
                              quantity: i.quantity,
                              batchNo: i.batchNo,
                              expiryDate: i.expiryDate,
                              mrp: i.mrp,
                            })),
                          })
                        }
                      >
                        <Download className="h-3.5 w-3.5" /> Download Report
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">MRP</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.medicineName}</TableCell>
                          <TableCell>{item.batchNo}</TableCell>
                          <TableCell>{formatDate(item.expiryDate)}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{formatInr(item.mrp)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
