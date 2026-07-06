import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listMedicines } from "@/lib/api/medicines.functions";
import { listBatchesForMedicine, listStockMovements, recordStockMovement, stockSummary } from "@/lib/api/stock.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/stat-card";
import { Wallet, AlertTriangle, PackageX } from "lucide-react";
import { formatInr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/stock/")({
  component: StockPage,
});

const MOVEMENT_TYPES = [
  { value: "in", label: "Stock In" },
  { value: "out", label: "Stock Out" },
  { value: "adjustment", label: "Stock Adjustment (set exact qty)" },
  { value: "transfer", label: "Stock Transfer" },
  { value: "damage", label: "Damage Stock" },
  { value: "lost", label: "Lost Stock" },
  { value: "expired", label: "Expired Stock" },
  { value: "return", label: "Return Stock" },
] as const;

function StockPage() {
  const queryClient = useQueryClient();
  const [medicineId, setMedicineId] = useState<number | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [type, setType] = useState<(typeof MOVEMENT_TYPES)[number]["value"]>("in");
  const [quantity, setQuantity] = useState(0);
  const [reason, setReason] = useState("");

  const { data: medicines } = useQuery({ queryKey: ["medicines", ""], queryFn: () => listMedicines() });
  const { data: batches } = useQuery({
    queryKey: ["batches", medicineId],
    queryFn: () => listBatchesForMedicine({ data: { medicineId: medicineId! } }),
    enabled: medicineId != null,
  });
  const { data: movements } = useQuery({ queryKey: ["stock-movements"], queryFn: () => listStockMovements({ data: { limit: 50 } }) });
  const { data: summary } = useQuery({ queryKey: ["stock-summary"], queryFn: () => stockSummary() });

  const mutation = useMutation({
    mutationFn: () => recordStockMovement({ data: { medicineId: medicineId!, batchId: batchId!, type, quantity, reason } }),
    onSuccess: () => {
      toast.success("Stock movement recorded.");
      setQuantity(0);
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["batches", medicineId] });
      queryClient.invalidateQueries({ queryKey: ["stock-summary"] });
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to record movement."),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Stock Management</h1>
        <p className="text-sm text-muted-foreground">
          Stock in/out, adjustments, transfers, damage, loss, expiry and returns — all in one place.
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Stock Value" value={formatInr(summary.totalStockValue)} icon={Wallet} />
          <StatCard label="Low Stock Batches" value={String(summary.lowStockCount)} icon={AlertTriangle} tone="warning" />
          <StatCard label="Out of Stock" value={String(summary.outOfStockCount)} icon={PackageX} tone="danger" />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Record Stock Movement</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Medicine</Label>
            <Select value={medicineId?.toString() ?? ""} onValueChange={(v) => { setMedicineId(Number(v)); setBatchId(null); }}>
              <SelectTrigger>
                <SelectValue placeholder="Select medicine" />
              </SelectTrigger>
              <SelectContent>
                {medicines?.map((m) => (
                  <SelectItem key={m.id} value={m.id.toString()}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Batch</Label>
            <Select value={batchId?.toString() ?? ""} onValueChange={(v) => setBatchId(Number(v))} disabled={!medicineId}>
              <SelectTrigger>
                <SelectValue placeholder="Select batch" />
              </SelectTrigger>
              <SelectContent>
                {batches?.map((b) => (
                  <SelectItem key={b.id} value={b.id.toString()}>
                    {b.batchNo} · qty {b.quantity} · exp {formatDate(b.expiryDate)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Movement Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">{type === "adjustment" ? "New Quantity" : "Quantity"}</Label>
            <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Reason / Note</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="col-span-2 md:col-span-5">
            <Button
              onClick={() => mutation.mutate()}
              disabled={!medicineId || !batchId || quantity <= 0 || mutation.isPending}
            >
              Record Movement
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Movements</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Medicine</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                    No stock movements yet.
                  </TableCell>
                </TableRow>
              )}
              {movements?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{formatDate(m.createdAt)}</TableCell>
                  <TableCell>{m.medicineName}</TableCell>
                  <TableCell>{m.batchNo || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{m.type}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{m.quantity}</TableCell>
                  <TableCell className="text-muted-foreground">{m.reason || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
