import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createBatch,
  updateBatch,
  deleteBatch,
  getExpiredTotalsForMedicine,
  recordStockMovement,
} from "@/lib/api/stock.functions";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export interface EditableBatch {
  id: number;
  batchNo: string;
  quantity: number;
  expiryDate: string;
  manufactureDate: string | null;
  purchasePrice: number;
  mrp: number;
  supplierId: number | null;
}

const emptyBatchForm = {
  batchNo: "",
  quantity: 0,
  expiryDate: "",
  manufactureDate: "",
  purchasePrice: 0,
  mrp: 0,
  supplierId: undefined as number | undefined,
};

// Shared Add/Edit-batch dialog, used from the Medicine Detail page, the Expiry dashboard, and the
// Inventory list — wherever a pharmacist needs to correct or add batch/expiry data because what's
// in the system doesn't match what's actually on the shelf (mismatched batch sold, stock never
// entered, etc.). Fully controlled by the caller (open state, which batch if any, save callback)
// so each page can trigger it from wherever makes sense for that page's layout.
export function BatchEditDialog({
  open,
  onOpenChange,
  medicineId,
  medicineLabel,
  batch,
  suppliers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineId: number;
  medicineLabel?: string;
  batch?: EditableBatch | null;
  suppliers: { id: number; name: string }[] | undefined;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyBatchForm);
  const isEdit = !!batch;

  useEffect(() => {
    if (!open) return;
    setForm(
      batch
        ? {
            batchNo: batch.batchNo,
            quantity: batch.quantity,
            expiryDate: batch.expiryDate,
            manufactureDate: batch.manufactureDate ?? "",
            purchasePrice: batch.purchasePrice,
            mrp: batch.mrp,
            supplierId: batch.supplierId ?? undefined,
          }
        : emptyBatchForm,
    );
  }, [open, batch]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = { ...form, manufactureDate: form.manufactureDate || undefined };
      return isEdit
        ? updateBatch({ data: { id: batch.id, ...payload } })
        : createBatch({ data: { medicineId, ...payload } });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Batch updated." : "Batch added.");
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save batch."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Batch" : "Add Batch"}
            {medicineLabel ? ` — ${medicineLabel}` : ""}
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Use this to correct or add stock manually — e.g. a batch that was sold but doesn't match what's
          recorded here, a batch that expired before it sold, or one missed during Purchase Entry.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Batch Number">
            <Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Stock Quantity">
            <Input
              type="number"
              placeholder="0"
              value={form.quantity || ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </Field>
          <Field label="Expiry Date">
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
          </Field>
          <Field label="Manufacture Date (optional)">
            <Input
              type="date"
              value={form.manufactureDate}
              onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })}
            />
          </Field>
          <Field label="Purchase Price">
            <Input
              type="number"
              placeholder="0"
              value={form.purchasePrice || ""}
              onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
            />
          </Field>
          <Field label="MRP">
            <Input
              type="number"
              placeholder="0"
              value={form.mrp || ""}
              onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })}
            />
          </Field>
          <Field label="Supplier">
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
          </Field>
        </div>
        <DialogFooter>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.batchNo || !form.expiryDate || saveMutation.isPending}
          >
            {isEdit ? "Save Changes" : "Add Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Shared delete-batch confirmation. `batch` doubles as the open/closed state — pass null to keep
// it closed, an {id, batchNo} to open it for that batch.
export function DeleteBatchDialog({
  batch,
  onOpenChange,
  onDeleted,
}: {
  batch: { id: number; batchNo: string } | null;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteBatch({ data: { id } }),
    onSuccess: () => {
      toast.success("Batch deleted.");
      onOpenChange(false);
      onDeleted();
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete — it may have sales or stock movements linked to it.",
      );
      onOpenChange(false);
    },
  });

  return (
    <AlertDialog open={!!batch} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete batch {batch?.batchNo}?</AlertDialogTitle>
          <AlertDialogDescription>
            This cannot be undone. If this batch has sales or stock movements linked to it, deletion will be
            blocked.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => batch && deleteMutation.mutate(batch.id)}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export interface ExpiryStockBatch {
  id: number;
  batchNo: string;
  mrp: number;
  quantity: number;
  purchasePrice?: number;
}

// Recording stock that has expired. The quantity entered is REMOVED from this batch's sellable
// stock and written off as expired — that write-off is what carries it onto the Expiry dashboard
// and onto the return claim for the batch's supplier. Deliberately narrower than BatchEditDialog:
// nothing about the batch itself is editable here. Name/Batch/MRP/Pack are shown read-only purely
// as confirmation that you're writing off the right thing.
export function AddExpiryQuantityDialog({
  open,
  onOpenChange,
  medicineId,
  medicineName,
  pack,
  batch,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineId: number;
  medicineName: string;
  pack?: string | null;
  batch: ExpiryStockBatch | null;
  onSaved: () => void;
}) {
  const [expiredQty, setExpiredQty] = useState(0);

  useEffect(() => {
    if (open) setExpiredQty(0);
  }, [open, batch]);

  const { data: expiredTotals } = useQuery({
    queryKey: ["expired-totals", medicineId],
    queryFn: () => getExpiredTotalsForMedicine({ data: { medicineId } }),
    // Callers that aren't scoped to a medicine pass 0 as a placeholder.
    enabled: open && medicineId > 0,
  });
  const expiredForBatch = expiredTotals?.find((t) => t.batchId === batch?.id)?.expiredQuantity ?? 0;
  const stock = batch?.quantity ?? 0;
  // recordStockMovement rejects a negative resulting stock; catch it before the round-trip.
  const exceedsStock = batch != null && expiredQty > stock;

  const saveMutation = useMutation({
    mutationFn: () =>
      recordStockMovement({
        data: {
          medicineId,
          batchId: batch!.id,
          type: "expired",
          quantity: expiredQty,
          reason: "Expired stock written off",
        },
      }),
    onSuccess: () => {
      toast.success(`Wrote off ${expiredQty} expired from batch ${batch?.batchNo}.`);
      onOpenChange(false);
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to record expired stock."),
  });

  return (
    <Dialog open={open && !!batch} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Expiry</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Records stock from this batch that has expired. The quantity is{" "}
          <span className="font-medium text-foreground">subtracted from sellable stock</span> and written off as
          expired, so it shows on the Expiry dashboard against this batch's supplier.
        </p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <ReadOnlyField label="Name" value={medicineName} />
          <ReadOnlyField label="Batch" value={batch?.batchNo ?? ""} />
          <ReadOnlyField label="MRP" value={formatInr(batch?.mrp ?? 0)} />
          <ReadOnlyField label="Pack" value={pack || "—"} />
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-md border border-dashed border-border p-3">
          <div>
            <p className="text-xs text-muted-foreground">Current Stock</p>
            <p className="text-lg font-semibold">{stock}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Already Written Off</p>
            <p className="text-lg font-semibold">{expiredForBatch}</p>
          </div>
        </div>
        <Field label="Expired Quantity">
          <Input
            type="number"
            placeholder="0"
            value={expiredQty || ""}
            onChange={(e) => setExpiredQty(Math.max(0, Number(e.target.value)))}
          />
        </Field>
        {exceedsStock && (
          <p className="text-xs font-medium text-destructive">
            Only {stock} in stock for this batch — can't write off more than that.
          </p>
        )}
        <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/40 p-3 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Stock After</p>
            <p className="text-base font-semibold">{Math.max(0, stock - expiredQty)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total Written Off</p>
            <p className="text-base font-semibold">{expiredForBatch + expiredQty}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Write-off Value</p>
            <p className="text-base font-semibold">
              {batch?.purchasePrice != null ? formatInr(expiredQty * batch.purchasePrice) : "—"}
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => saveMutation.mutate()}
            disabled={!batch || expiredQty <= 0 || exceedsStock || saveMutation.isPending}
          >
            Add Expiry
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
