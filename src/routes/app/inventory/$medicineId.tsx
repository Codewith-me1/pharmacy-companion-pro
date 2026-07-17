import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Package, Pencil, Plus, Trash2, Truck, Wallet } from "lucide-react";
import { getMedicineDetail } from "@/lib/api/medicines.functions";
import { createBatch, updateBatch, deleteBatch } from "@/lib/api/stock.functions";
import { listSuppliers } from "@/lib/api/suppliers.functions";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDate, formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/inventory/$medicineId")({
  component: MedicineDetailPage,
});

const emptyBatch = {
  batchNo: "",
  quantity: 0,
  expiryDate: "",
  manufactureDate: "",
  purchasePrice: 0,
  mrp: 0,
  supplierId: undefined as number | undefined,
};

function MedicineDetailPage() {
  const { medicineId } = Route.useParams();
  const id = Number(medicineId);
  const queryClient = useQueryClient();
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [editingBatchId, setEditingBatchId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyBatch);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; batchNo: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["medicine-detail-page", id],
    queryFn: () => getMedicineDetail({ data: { id } }),
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  function openAddBatch() {
    setEditingBatchId(null);
    setForm(emptyBatch);
    setBatchDialogOpen(true);
  }

  function openEditBatch(b: NonNullable<typeof data>["batches"][number]) {
    setEditingBatchId(b.id);
    setForm({
      batchNo: b.batchNo,
      quantity: b.quantity,
      expiryDate: b.expiryDate,
      manufactureDate: b.manufactureDate ?? "",
      purchasePrice: b.purchasePrice,
      mrp: b.mrp,
      supplierId: b.supplierId ?? undefined,
    });
    setBatchDialogOpen(true);
  }

  const saveBatchMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, manufactureDate: form.manufactureDate || undefined };
      return editingBatchId
        ? updateBatch({ data: { id: editingBatchId, ...payload } })
        : createBatch({ data: { medicineId: id, ...payload } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicine-detail-page", id] });
      queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
      toast.success(editingBatchId ? "Batch updated." : "Batch added.");
      setBatchDialogOpen(false);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save batch."),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: (batchId: number) => deleteBatch({ data: { id: batchId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicine-detail-page", id] });
      queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
      toast.success("Batch deleted.");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete — it may have sales or stock movements linked to it.",
      );
      setDeleteTarget(null);
    },
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading medicine…</div>;
  }

  if (!data?.medicine) {
    return (
      <div className="flex flex-col items-center gap-3 p-16 text-center text-muted-foreground">
        <p>Medicine not found.</p>
        <Button asChild variant="outline">
          <Link to="/app/inventory" search={{ q: "" }}>Back to Inventory</Link>
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
          <Link to="/app/inventory" search={{ q: "" }}>
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
          <Detail label="Discount %" value={`${m.discount}%`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-sm">Batches &amp; Suppliers ({data.batches.length})</CardTitle>
          <Dialog
            open={batchDialogOpen}
            onOpenChange={(open) => {
              setBatchDialogOpen(open);
              if (!open) {
                setEditingBatchId(null);
                setForm(emptyBatch);
              }
            }}
          >
            <Button size="sm" onClick={openAddBatch}>
              <Plus className="h-4 w-4" /> Add Batch
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingBatchId ? "Edit Batch" : "Add Batch"}</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Use this to correct or add stock manually — e.g. a batch that expired today but was
                still sold before close of business, or a batch missed during Purchase Entry.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <F label="Batch Number">
                  <Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
                </F>
                <F label="Stock Quantity">
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.quantity || ""}
                    onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  />
                </F>
                <F label="Expiry Date">
                  <Input
                    type="date"
                    value={form.expiryDate}
                    onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
                  />
                </F>
                <F label="Manufacture Date (optional)">
                  <Input
                    type="date"
                    value={form.manufactureDate}
                    onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })}
                  />
                </F>
                <F label="Purchase Price">
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.purchasePrice || ""}
                    onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                  />
                </F>
                <F label="MRP">
                  <Input
                    type="number"
                    placeholder="0"
                    value={form.mrp || ""}
                    onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })}
                  />
                </F>
                <F label="Supplier">
                  <Select
                    value={form.supplierId?.toString() ?? "none"}
                    onValueChange={(v) => setForm({ ...form, supplierId: v === "none" ? undefined : Number(v) })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {suppliers?.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </F>
              </div>
              <DialogFooter>
                <Button
                  onClick={() => saveBatchMutation.mutate()}
                  disabled={!form.batchNo || !form.expiryDate || saveBatchMutation.isPending}
                >
                  {editingBatchId ? "Save Changes" : "Add Batch"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
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
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.batches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="p-8 text-center text-muted-foreground">
                    No batches recorded for this medicine yet. Use "Add Batch" to create one.
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
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditBatch(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteTarget({ id: b.id, batchNo: b.batchNo })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete batch {deleteTarget?.batchNo}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If this batch has sales or stock movements linked to it, deletion will be
              blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteBatchMutation.mutate(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
