import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Package, Truck, Wallet } from "lucide-react";
import { getMedicineDetail } from "@/lib/api/medicines.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/inventory/$medicineId")({
  component: MedicineDetailPage,
});

function MedicineDetailPage() {
  const { medicineId } = Route.useParams();
  const id = Number(medicineId);
  const { data, isLoading } = useQuery({
    queryKey: ["medicine-detail-page", id],
    queryFn: () => getMedicineDetail({ data: { id } }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading medicine…</div>;
  }

  if (!data?.medicine) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center text-muted-foreground">
        <p>Medicine not found.</p>
        <Button asChild variant="outline">
          <Link to="/app/inventory">Back to Inventory</Link>
        </Button>
      </div>
    );
  }

  const m = data.medicine;
  const now = Date.now();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/app/inventory">
            <ArrowLeft className="h-4 w-4" /> Back to Inventory
          </Link>
        </Button>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-xl font-bold">{m.name}</h1>
          {m.brand && <span className="text-sm text-muted-foreground">Brand: {m.brand}</span>}
          {m.category && <Badge variant="outline">{m.category}</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">{[m.company, m.category].filter(Boolean).join(" · ") || "—"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Total Stock" value={String(data.totalStock ?? 0)} icon={Package} />
        <StatCard label="Stock Value" value={formatInr(data.totalStockValue)} icon={Wallet} />
        <StatCard label="MRP" value={formatInr(m.mrp)} icon={Wallet} />
        <StatCard label="Batches from Suppliers" value={String(new Set(data.batches.map((b) => b.supplierId)).size)} icon={Truck} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Medicine Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Detail label="Pack" value={m.pack} />
          <Detail label="HSN Code" value={m.hsnCode} />
          <Detail label="Barcode" value={m.barcode} />
          <Detail label="MRP" value={formatInr(m.mrp)} />
          <Detail label="Selling Price" value={formatInr(m.sellingPrice)} />
          <Detail label="Purchase Price" value={formatInr(m.purchasePrice)} />
          <Detail label="GST %" value={`${m.gstPercent}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Batches &amp; Suppliers ({data.batches.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch No.</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead>Mfg</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Purchase ₹</TableHead>
                <TableHead className="text-right">MRP ₹</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Supplier Phone</TableHead>
                <TableHead>Supplier GST</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="p-8 text-center text-muted-foreground">
                    No batches recorded for this medicine yet.
                  </TableCell>
                </TableRow>
              )}
              {data.batches.map((b) => {
                const daysToExpiry = Math.ceil((new Date(b.expiryDate).getTime() - now) / 86_400_000);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.batchNo}</TableCell>
                    <TableCell>
                      {formatDate(b.expiryDate)}{" "}
                      {daysToExpiry <= 90 && (
                        <Badge variant={daysToExpiry <= 30 ? "destructive" : "secondary"} className="ml-1 text-[10px]">
                          {daysToExpiry <= 0 ? "expired" : `${daysToExpiry}d left`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{formatDate(b.manufactureDate)}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={b.quantity === 0 ? "destructive" : b.quantity <= 10 ? "secondary" : "outline"}>
                        {b.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatInr(b.purchasePrice)}</TableCell>
                    <TableCell className="text-right font-mono">{formatInr(b.mrp)}</TableCell>
                    <TableCell>{b.supplierName || "—"}</TableCell>
                    <TableCell>{b.supplierPhone || "—"}</TableCell>
                    <TableCell>{b.supplierGstNumber || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Stock Movements</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.movements.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-6 text-center text-muted-foreground">
                      No movements yet.
                    </TableCell>
                  </TableRow>
                )}
                {data.movements.map((mv) => (
                  <TableRow key={mv.id}>
                    <TableCell>{formatDate(mv.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{mv.type}</Badge>
                    </TableCell>
                    <TableCell>{mv.batchNo || "—"}</TableCell>
                    <TableCell className="text-right font-mono">{mv.quantity}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Recent Sales</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Bill #</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentSales.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="p-6 text-center text-muted-foreground">
                      Not sold yet.
                    </TableCell>
                  </TableRow>
                )}
                {data.recentSales.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{formatDate(s.createdAt)}</TableCell>
                    <TableCell>{s.billNumber}</TableCell>
                    <TableCell className="text-right">{s.quantity}</TableCell>
                    <TableCell className="text-right font-mono">{formatInr(s.salePrice)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || value === 0 ? value : "—"}</p>
    </div>
  );
}
