import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { SearchCheck } from "lucide-react";
import { listMedicines } from "@/lib/api/medicines.functions";
import { listSuppliers } from "@/lib/api/suppliers.functions";
import { createBatch } from "@/lib/api/stock.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const emptyForm = {
  medicineId: undefined as number | undefined,
  medicineLabel: "",
  batchNo: "",
  supplierId: undefined as number | undefined,
  manufactureDate: "",
  expiryDate: "",
  purchasePrice: 0,
  mrp: 0,
  quantity: 0,
  freeQuantity: 0,
  cgstPercent: 6,
  sgstPercent: 6,
  remarks: "",
};

// Fixes a real gap: "Initial Stock" on Add Medicine is optional, but once skipped there was no
// way back in — Record Stock Movement on the Stock page requires picking an existing batch, and a
// medicine with none has nothing to pick. This is the from-scratch path: search for any medicine
// (whether or not it already has stock) and bring in a fresh batch directly.
export function AddBatchDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [medicinePickerOpen, setMedicinePickerOpen] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");

  const { data: medicineResults } = useQuery({
    queryKey: ["medicines", medicineSearch],
    queryFn: () => listMedicines({ data: { search: medicineSearch } }),
    enabled: medicinePickerOpen,
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  function reset() {
    setForm(emptyForm);
    setMedicineSearch("");
  }

  const saveMutation = useMutation({
    mutationFn: () =>
      createBatch({
        data: {
          medicineId: form.medicineId!,
          batchNo: form.batchNo,
          supplierId: form.supplierId,
          manufactureDate: form.manufactureDate || undefined,
          expiryDate: form.expiryDate,
          purchasePrice: form.purchasePrice,
          mrp: form.mrp,
          quantity: form.quantity,
          freeQuantity: form.freeQuantity,
          cgstPercent: form.cgstPercent,
          sgstPercent: form.sgstPercent,
          remarks: form.remarks.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success(`Batch added for ${form.medicineLabel}.`);
      onOpenChange(false);
      reset();
      onSaved();
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add batch."),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Batch</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Bring any medicine into stock directly — useful when a medicine was added without an opening batch, or
          a fresh delivery needs to be logged without going through Purchase Entry.
        </p>

        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Product Name</Label>
          <Popover open={medicinePickerOpen} onOpenChange={setMedicinePickerOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="outline"
                role="combobox"
                className="w-full justify-start gap-2 font-normal text-muted-foreground"
              >
                <SearchCheck className="h-4 w-4" />
                {form.medicineLabel || "Search medicine by name…"}
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
                          const halfGst = m.gstPercent / 2;
                          setForm((f) => ({
                            ...f,
                            medicineId: m.id,
                            medicineLabel: m.pack ? `${m.name} (${m.pack})` : m.name,
                            purchasePrice: m.purchasePrice,
                            mrp: m.mrp,
                            cgstPercent: halfGst,
                            sgstPercent: halfGst,
                          }));
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

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <F label="Batch Number">
            <Input
              value={form.batchNo}
              onChange={(e) => setForm({ ...form, batchNo: e.target.value.toUpperCase() })}
            />
          </F>
          <F label="Supplier (optional)">
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
          <F label="MFG Date (optional)">
            <Input
              type="date"
              value={form.manufactureDate}
              onChange={(e) => setForm({ ...form, manufactureDate: e.target.value })}
            />
          </F>
          <F label="Expiry Date">
            <Input
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
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
          <F label="Total Quantity">
            <Input
              type="number"
              placeholder="0"
              value={form.quantity || ""}
              onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
            />
          </F>
          <F label="Free Quantity (optional)">
            <Input
              type="number"
              placeholder="0"
              value={form.freeQuantity || ""}
              onChange={(e) => setForm({ ...form, freeQuantity: Number(e.target.value) })}
            />
          </F>
          <F label="CGST %">
            <Input
              type="number"
              placeholder="0"
              value={form.cgstPercent || ""}
              onChange={(e) => setForm({ ...form, cgstPercent: Number(e.target.value) })}
            />
          </F>
          <F label="SGST %">
            <Input
              type="number"
              placeholder="0"
              value={form.sgstPercent || ""}
              onChange={(e) => setForm({ ...form, sgstPercent: Number(e.target.value) })}
            />
          </F>
        </div>

        <F label="Remarks (optional)">
          <Textarea
            placeholder="Why this batch is being added manually, or anything worth noting…"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            rows={2}
          />
        </F>

        <DialogFooter>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!form.medicineId || !form.batchNo || !form.expiryDate || saveMutation.isPending}
          >
            Add Batch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
