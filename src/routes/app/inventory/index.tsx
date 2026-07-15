import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { IndianRupee, ListFilter, Pencil, Pill, Plus, Search, SearchCheck, Trash2 } from "lucide-react";
import { listMedicines, upsertMedicine, deleteMedicine } from "@/lib/api/medicines.functions";
import { listSuppliers } from "@/lib/api/suppliers.functions";
import { MEDICINE_CATEGORIES } from "@/lib/medicine-categories";
import { MEDICINE_CATALOG, type MedicineCatalogItem } from "@/lib/medicine-catalog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/inventory/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Inventory,
});

const emptyMedicine = {
  name: "",
  brand: "",
  company: "",
  category: "",
  pack: "",
  mrp: 0,
  sellingPrice: 0,
  purchasePrice: 0,
  gstPercent: 12,
  discount: 0,
  hsnCode: "",
  barcode: "",
  batchNo: "",
  quantity: 0,
  expiryDate: "",
  supplierId: undefined as number | undefined,
};

function Inventory() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyMedicine);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["medicines", search],
    queryFn: () => listMedicines({ data: { search } }),
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });

  function openAdd() {
    setEditingId(null);
    setForm(emptyMedicine);
    setAddOpen(true);
  }

  function openEdit(m: NonNullable<typeof data>[number]) {
    setEditingId(m.id);
    setForm({
      name: m.name,
      brand: m.brand ?? "",
      company: m.company ?? "",
      category: m.category ?? "",
      pack: m.pack ?? "",
      mrp: m.mrp,
      sellingPrice: m.sellingPrice,
      purchasePrice: m.purchasePrice,
      gstPercent: m.gstPercent,
      discount: m.discount,
      hsnCode: m.hsnCode ?? "",
      barcode: m.barcode ?? "",
      batchNo: "",
      quantity: 0,
      expiryDate: "",
      supplierId: undefined,
    });
    setAddOpen(true);
  }

  function applyCatalogItem(item: MedicineCatalogItem) {
    setForm((f) => ({
      ...f,
      name: item.name,
      brand: item.brand,
      company: item.company,
      category: item.category,
      pack: item.pack,
      hsnCode: item.hsnCode,
      gstPercent: item.gstPercent,
    }));
    setCatalogOpen(false);
    toast.success(`Filled details for ${item.brand}. Add your pricing to finish.`);
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertMedicine({ data: { ...form, id: editingId ?? undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      toast.success(editingId ? "Medicine updated." : "Medicine added.");
      setAddOpen(false);
      setEditingId(null);
      setForm(emptyMedicine);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save medicine."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteMedicine({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      toast.success("Medicine deleted.");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete — it may have batches or sales linked to it.",
      );
      setDeleteTarget(null);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Medicine master and batch-level stock.</p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              setEditingId(null);
              setForm(emptyMedicine);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Medicine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Medicine" : "Add Medicine"}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col gap-5">
              {!editingId && (
                <div className="flex flex-col gap-1.5 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-3">
                  <Label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <SearchCheck className="h-3.5 w-3.5 text-primary" /> Quick-fill from medicine catalog
                  </Label>
                  <Popover open={catalogOpen} onOpenChange={setCatalogOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start gap-2 bg-background font-normal text-muted-foreground"
                      >
                        <Search className="h-4 w-4" />
                        Search common medicines by name, brand or company…
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="e.g. Paracetamol, Dolo, Cipla…" />
                        <CommandList>
                          <CommandEmpty>No match in the catalog — enter details manually below.</CommandEmpty>
                          <CommandGroup>
                            {MEDICINE_CATALOG.map((item, i) => (
                              <CommandItem
                                key={i}
                                value={`${item.name} ${item.brand} ${item.company} ${item.category}`}
                                onSelect={() => applyCatalogItem(item)}
                              >
                                <div className="flex flex-1 items-center justify-between gap-2">
                                  <div className="flex flex-col">
                                    <span className="font-medium">{item.brand}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {item.name} · {item.company}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="shrink-0 text-[10px]">
                                    {item.category}
                                  </Badge>
                                </div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <p className="text-[11px] text-muted-foreground">
                    Fills name, brand, company, category, pack, HSN and GST from a common-medicines reference list —
                    add your own pricing and stock after.
                  </p>
                </div>
              )}

              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Pill className="h-4 w-4 text-muted-foreground" /> Medicine Details
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
                  <F label="Name">
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </F>
                  <F label="Brand">
                    <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
                  </F>
                  <F label="Company">
                    <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  </F>
                  <F label="Category">
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {MEDICINE_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Pack">
                    <Input
                      placeholder="e.g. 10s, 200ML"
                      value={form.pack}
                      onChange={(e) => setForm({ ...form, pack: e.target.value })}
                    />
                  </F>
                  <F label="Barcode">
                    <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
                  </F>
                </div>
              </section>

              <Separator />

              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <IndianRupee className="h-4 w-4 text-muted-foreground" /> Pricing &amp; Tax
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                  <F label="MRP">
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.mrp || ""}
                      onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })}
                    />
                  </F>
                  <F label="Selling Price">
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.sellingPrice || ""}
                      onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
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
                  <F label="GST %">
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.gstPercent || ""}
                      onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })}
                    />
                  </F>
                  <F label="Discount %">
                    <Input
                      type="number"
                      placeholder="0"
                      value={form.discount || ""}
                      onChange={(e) => setForm({ ...form, discount: Number(e.target.value) })}
                    />
                  </F>
                  <F label="HSN Code">
                    <Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
                  </F>
                </div>
              </section>

              {!editingId && (
                <>
                  <Separator />
                  <section className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <ListFilter className="h-4 w-4 text-muted-foreground" /> Initial Stock
                      <span className="text-xs font-normal text-muted-foreground">(optional — creates the first batch)</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
                      <F label="Batch Number">
                        <Input value={form.batchNo} onChange={(e) => setForm({ ...form, batchNo: e.target.value })} />
                      </F>
                      <F label="Stock">
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
                  </section>
                </>
              )}
            </div>

            <DialogFooter>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                Save Medicine
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by medicine, company, or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>HSN</TableHead>
                <TableHead className="text-right">GST%</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {data?.map((m) => (
                <TableRow
                  key={m.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/app/inventory/$medicineId", params: { medicineId: String(m.id) } })}
                >
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.pack || "—"}</TableCell>
                  <TableCell>{m.company || "—"}</TableCell>
                  <TableCell>{m.category || "—"}</TableCell>
                  <TableCell>{m.hsnCode || "—"}</TableCell>
                  <TableCell className="text-right">{m.gstPercent}%</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(m.mrp)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={m.totalStock === 0 ? "destructive" : m.totalStock <= 10 ? "secondary" : "outline"}>
                      {m.totalStock}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(m);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: m.id, name: m.name });
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If this medicine has batches, purchases or sales linked to it, deletion will be
              blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
