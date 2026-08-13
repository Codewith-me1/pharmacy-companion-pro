import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SearchCheck } from "lucide-react";
import { listMedicines } from "@/lib/api/medicines.functions";
import { listBatchesForMedicine, recordStockMovement } from "@/lib/api/stock.functions";
import { formatDate, formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

// Same job as AddExpiryQuantityDialog ("more of this batch turned up than the system shows"), but
// reachable in one click from the Inventory toolbar instead of row → Batches & Expiry → per-batch
// icon. Because it isn't launched from a medicine row, it carries its own medicine picker and batch
// selector: search a medicine, pick the batch, add the quantity.
export function AddExpiryStockDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [medicine, setMedicine] = useState<{ id: number; label: string; pack: string | null } | null>(null);
  const [batchId, setBatchId] = useState<number | null>(null);
  const [addQty, setAddQty] = useState(0);
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

  const selectedBatch = batches?.find((b) => b.id === batchId) ?? null;

  // A batch list is only ever valid for the medicine it was loaded for.
  useEffect(() => {
    setBatchId(null);
    setAddQty(0);
  }, [medicine?.id]);

  function reset() {
    setMedicine(null);
    setBatchId(null);
    setAddQty(0);
    setMedicineSearch("");
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      recordStockMovement({
        data: {
          medicineId: medicine!.id,
          batchId: selectedBatch!.id,
          type: "in",
          quantity: addQty,
          reason: "Added to expiry stock count",
        },
      }),
    onSuccess: () => {
      toast.success(`Added ${addQty} to batch ${selectedBatch?.batchNo}.`);
      onOpenChange(false);
      reset();
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add stock."),
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
          <DialogTitle>Add Expiry Stock</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          For when more of a batch turns up than the system shows — e.g. it was sold from the wrong batch, or never
          entered. Pick the medicine, pick the batch, add the quantity; nothing else about the batch changes.
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
                  {b.batchNo} · exp {formatDate(b.expiryDate)} · qty {b.quantity}
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
              <ReadOnlyField label="Supplier" value={selectedBatch.supplierName || "—"} />
              <ReadOnlyField label="Current Total" value={String(selectedBatch.quantity)} />
            </div>

            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">3. Quantity to Add</Label>
              <Input
                type="number"
                placeholder="0"
                value={addQty || ""}
                onChange={(e) => setAddQty(Math.max(0, Number(e.target.value)))}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              New Total: <span className="font-semibold text-foreground">{selectedBatch.quantity + addQty}</span>
            </p>
          </>
        )}

        <DialogFooter>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedBatch || addQty <= 0 || saveMutation.isPending}
          >
            Add to Stock
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
