import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SearchCheck } from "lucide-react";
import { listMedicines } from "@/lib/api/medicines.functions";
import {
  getExpiredTotalsForMedicine,
  listBatchesForMedicine,
  recordStockMovement,
} from "@/lib/api/stock.functions";
import { formatDate, formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Writing off expired stock, in one click from the Inventory toolbar: search a medicine, pick the
// batch, enter how many units expired. Records an "expired" stock movement, which *removes* that
// quantity from the batch's sellable stock and adds it to the medicine's expired total — the same
// movement type as Stock Management's "Expired Stock", so both paths land in one ledger.
export function AddExpiryStockDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [medicine, setMedicine] = useState<{
    id: number;
    label: string;
    pack: string | null;
  } | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [expiredQty, setExpiredQty] = useState(0);
  const [medicinePickerOpen, setMedicinePickerOpen] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");

  const { data: medicineResults } = useQuery({
    queryKey: ["medicines", medicineSearch],
    queryFn: () => listMedicines({ data: { search: medicineSearch } }),
    enabled: medicinePickerOpen,
  });
  const { data: batches, isLoading: batchesLoading } = useQuery({
    queryKey: ["batches-for-medicine", medicine?.id],
    queryFn: () => listBatchesForMedicine({ data: { medicineId: medicine!.id } }),
    enabled: medicine != null,
  });
  const { data: expiredTotals } = useQuery({
    queryKey: ["expired-totals", medicine?.id],
    queryFn: () => getExpiredTotalsForMedicine({ data: { medicineId: medicine!.id } }),
    enabled: medicine != null,
  });

  const selectedBatch = batches?.find((b) => b.id === batchId) ?? null;
  const expiredForBatch = expiredTotals?.find((t) => t.batchId === batchId)?.expiredQuantity ?? 0;
  const expiredForMedicine = expiredTotals?.reduce((sum, t) => sum + t.expiredQuantity, 0) ?? 0;
  // The server rejects a negative resulting stock; mirror that here so it's caught before saving.
  const exceedsStock = selectedBatch != null && expiredQty > selectedBatch.quantity;

  // A batch list is only ever valid for the medicine it was loaded for.
  useEffect(() => {
    setBatchId(null);
    setExpiredQty(0);
  }, [medicine?.id]);

  function reset() {
    setMedicine(null);
    setBatchId(null);
    setExpiredQty(0);
    setMedicineSearch("");
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      recordStockMovement({
        data: {
          medicineId: medicine!.id,
          batchId: selectedBatch!.id,
          type: "expired",
          quantity: expiredQty,
          reason: "Expired stock written off",
        },
      }),
    onSuccess: () => {
      toast.success(`Wrote off ${expiredQty} expired from batch ${selectedBatch?.batchNo}.`);
      onOpenChange(false);
      reset();
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to record expired stock."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Expiry</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Records stock that has expired and is off the shelf. The quantity is{" "}
          <span className="font-medium text-foreground">removed from sellable stock</span> and added to this
          medicine's expired total — nothing else about the batch changes.
        </p>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">1. Medicine</Label>
          <Popover open={medicinePickerOpen} onOpenChange={setMedicinePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-start gap-2 font-normal text-muted-foreground"
              >
                <SearchCheck className="h-4 w-4" />
                {medicine?.label || "Search medicine by name…"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
              <Command shouldFilter={false}>
                <CommandInput
                  placeholder="Type a medicine name…"
                  value={medicineSearch}
                  onValueChange={setMedicineSearch}
                />
                <CommandList>
                  <CommandEmpty>No medicine matched.</CommandEmpty>
                  <CommandGroup>
                    {medicineResults?.map((m) => (
                      <CommandItem
                        key={m.id}
                        value={String(m.id)}
                        onSelect={() => {
                          setMedicine({
                            id: m.id,
                            label: m.pack ? `${m.name} (${m.pack})` : m.name,
                            pack: m.pack,
                          });
                          setMedicinePickerOpen(false);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="font-medium">{m.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {[m.pack, m.company].filter(Boolean).join(" · ") || "—"}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          {medicine && expiredForMedicine > 0 && (
            <p className="text-[11px] text-muted-foreground">
              Already written off across all batches: {expiredForMedicine}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">2. Batch</Label>
          <Select
            value={batchId?.toString() ?? ""}
            onValueChange={(v) => setBatchId(Number(v))}
            disabled={!medicine || batchesLoading || (batches?.length ?? 0) === 0}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  !medicine
                    ? "Select a medicine first"
                    : batchesLoading
                      ? "Loading batches…"
                      : (batches?.length ?? 0) === 0
                        ? "No batches recorded for this medicine"
                        : "Select batch"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {batches?.map((b) => (
                <SelectItem key={b.id} value={b.id.toString()}>
                  {b.batchNo} · exp {formatDate(b.expiryDate)} · stock {b.quantity}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {medicine && !batchesLoading && (batches?.length ?? 0) === 0 && (
            <p className="text-[11px] text-muted-foreground">
              This medicine has no batches yet — use Add Batch to create the first one.
            </p>
          )}
        </div>

        {selectedBatch && (
          <>
            <div className="grid grid-cols-2 gap-3 rounded-md border border-dashed border-border p-3 text-sm">
              <ReadOnlyField label="Batch" value={selectedBatch.batchNo} />
              <ReadOnlyField label="Expiry" value={formatDate(selectedBatch.expiryDate)} />
              <ReadOnlyField label="MRP" value={formatInr(selectedBatch.mrp)} />
              <ReadOnlyField label="Pack" value={medicine?.pack || "—"} />
              <ReadOnlyField label="Current Stock" value={String(selectedBatch.quantity)} />
              <ReadOnlyField label="Already Expired" value={String(expiredForBatch)} />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">3. Expired Quantity</Label>
              <Input
                type="number"
                placeholder="0"
                value={expiredQty || ""}
                onChange={(e) => setExpiredQty(Math.max(0, Number(e.target.value)))}
              />
              {exceedsStock && (
                <p className="text-[11px] font-medium text-destructive">
                  Only {selectedBatch.quantity} in stock for this batch — can't write off more than that.
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3 rounded-md bg-muted/40 p-3 text-sm">
              <SummaryField
                label="Stock After"
                value={String(Math.max(0, selectedBatch.quantity - expiredQty))}
              />
              <SummaryField label="Total Expired" value={String(expiredForBatch + expiredQty)} />
              <SummaryField
                label="Write-off Value"
                value={formatInr(expiredQty * selectedBatch.purchasePrice)}
              />
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant="destructive"
            onClick={() => saveMutation.mutate()}
            disabled={!selectedBatch || expiredQty <= 0 || exceedsStock || saveMutation.isPending}
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

function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}
