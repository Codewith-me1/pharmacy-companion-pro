import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Package, Receipt, Wallet } from "lucide-react";
import { getSupplier } from "@/lib/api/suppliers.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/suppliers/$supplierId")({
  component: SupplierDetailPage,
});

function SupplierDetailPage() {
  const { supplierId } = Route.useParams();
  const id = Number(supplierId);
  const { data, isLoading } = useQuery({
    queryKey: ["supplier-detail-page", id],
    queryFn: () => getSupplier({ data: { id } }),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading supplier…</div>;
  }

  if (!data?.supplier) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center text-muted-foreground">
        <p>Supplier not found.</p>
        <Button asChild variant="outline">
          <Link to="/app/suppliers" search={{ q: "" }}>Back to Suppliers</Link>
        </Button>
      </div>
    );
  }

  const { supplier, purchaseHistory, medicinesPurchased } = data;
  const totalPurchases = purchaseHistory.reduce((sum, p) => sum + p.invoiceTotal, 0);
  const distinctMedicines = new Set(medicinesPurchased.map((m) => m.medicineId)).size;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/app/suppliers" search={{ q: "" }}>
            <ArrowLeft className="h-4 w-4" /> Back to Suppliers
          </Link>
        </Button>
        <h1 className="text-xl font-bold">{supplier.name}</h1>
        <p className="text-sm text-muted-foreground">{supplier.address || "—"}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Credit Days" value={String(supplier.creditDays)} icon={CalendarClock} />
        <StatCard
          label="Outstanding (Due)"
          value={formatInr(supplier.outstanding)}
          icon={Wallet}
          tone={supplier.outstanding > 0 ? "danger" : "success"}
        />
        <StatCard label="Total Purchases" value={formatInr(totalPurchases)} icon={Receipt} />
        <StatCard label="Medicines Purchased" value={String(distinctMedicines)} icon={Package} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Supplier Details</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
          <Detail label="GST Number" value={supplier.gstNumber} />
          <Detail label="D.L. No" value={supplier.dlNo} />
          <Detail label="Phone" value={supplier.phone} />
          <Detail label="Credit Days" value={`${supplier.creditDays} days`} />
          <Detail label="Outstanding (Due)" value={formatInr(supplier.outstanding)} />
          <Detail label="Address" value={supplier.address} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Invoice History ({purchaseHistory.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchaseHistory.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="p-8 text-center text-muted-foreground">
                    No purchase history
                  </TableCell>
                </TableRow>
              )}
              {purchaseHistory.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.invoiceNumber || "—"}</TableCell>
                  <TableCell>{formatDate(p.createdAt)}</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(p.invoiceTotal)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Medicines Purchased ({medicinesPurchased.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Batch No.</TableHead>
                <TableHead>Purchased</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Stock Left</TableHead>
                <TableHead className="text-right">Purchase ₹</TableHead>
                <TableHead className="text-right">MRP ₹</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {medicinesPurchased.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    No medicines purchased from this supplier yet.
                  </TableCell>
                </TableRow>
              )}
              {medicinesPurchased.map((m) => {
                const daysToExpiry = Math.ceil((new Date(m.expiryDate).getTime() - Date.now()) / 86_400_000);
                return (
                  <TableRow key={m.batchId}>
                    <TableCell className="font-medium">
                      {m.medicineName}
                      {m.pack ? <span className="text-muted-foreground"> ({m.pack})</span> : ""}
                    </TableCell>
                    <TableCell>{m.batchNo}</TableCell>
                    <TableCell>{formatDate(m.purchasedAt)}</TableCell>
                    <TableCell>
                      {formatDate(m.expiryDate)}{" "}
                      {daysToExpiry <= 90 && (
                        <Badge variant={daysToExpiry <= 30 ? "destructive" : "secondary"} className="ml-1 text-[10px]">
                          {daysToExpiry <= 0 ? "expired" : `${daysToExpiry}d left`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={m.quantity === 0 ? "destructive" : m.quantity <= 10 ? "secondary" : "outline"}>
                        {m.quantity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatInr(m.purchasePrice)}</TableCell>
                    <TableCell className="text-right font-mono">{formatInr(m.mrp)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
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
