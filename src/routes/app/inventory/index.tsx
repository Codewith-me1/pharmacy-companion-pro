import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CalendarClock, CalendarPlus, IndianRupee, ListFilter, Pencil, Pill, Plus, Search, SearchCheck, Trash2 } from "lucide-react";
import { listMedicines, upsertMedicine, deleteMedicine, bulkImportMedicines } from "@/lib/api/medicines.functions";
import { listSuppliers } from "@/lib/api/suppliers.functions";
import { listBatchesForMedicine } from "@/lib/api/stock.functions";
import { MEDICINE_CATEGORIES } from "@/lib/medicine-categories";
import { MEDICINE_CATALOG, type MedicineCatalogItem } from "@/lib/medicine-catalog";
import { ImportCsvDialog } from "@/components/import-csv-dialog";
import type { CsvTemplateColumn } from "@/lib/csv";
import {
  AddExpiryQuantityDialog,
  BatchEditDialog,
  DeleteBatchDialog,
  type EditableBatch,
  type ExpiryStockBatch,
} from "@/components/batch-dialogs";
import { AddBatchDialog } from "@/components/add-batch-dialog";
import { AddExpiryStockDialog } from "@/components/add-expiry-stock-dialog";
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
import { formatDate, formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/inventory/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: Inventory,
});

const MEDICINE_IMPORT_COLUMNS: CsvTemplateColumn[] = [
  { key: "name", label: "Name", required: true, example: "PARACETAMOL" },
  { key: "brand", label: "Brand", example: "CROCIN" },
  { key: "company", label: "Manufacturer Name", example: "GSK" },
  { key: "category", label: "Medicine Type", example: "Tablet" },
  { key: "pack", label: "Pack", example: "10X10" },
  { key: "mrp", label: "MRP", example: "35" },
  { key: "sellingPrice", label: "Selling Price", example: "32" },
  { key: "purchasePrice", label: "Purchase Price", example: "20" },
  { key: "gstPercent", label: "GST Percent", example: "12" },
  { key: "discount", label: "Discount Percent", example: "0" },
  { key: "hsnCode", label: "HSN Code", example: "30049099" },
  { key: "barcode", label: "Barcode", example: "" },
];

const emptyMedicine = {
  name: "",
  company: "",
  category: "",
  pack: "",
  mrp: 0,
  sellingPrice: 0,
  purchasePrice: 0,
  cgstPercent: 6,
  sgstPercent: 6,
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
  const [batchSearch, setBatchSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | undefined>(undefined);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyMedicine);
  const [batchesFor, setBatchesFor] = useState<{ id: number; name: string; pack: string | null } | null>(null);
  const [editingBatch, setEditingBatch] = useState<EditableBatch | null>(null);
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<{ id: number; batchNo: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [addExpiryOpen, setAddExpiryOpen] = useState(false);
  const [expiryQtyTarget, setExpiryQtyTarget] = useState<ExpiryStockBatch | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ["medicines", search, batchSearch, supplierFilter],
    queryFn: () => listMedicines({ data: { search, batchSearch, supplierId: supplierFilter } }),
  });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const { data: batchesForMedicine } = useQuery({
    queryKey: ["batches-for-medicine", batchesFor?.id],
    queryFn: () => listBatchesForMedicine({ data: { medicineId: batchesFor!.id } }),
    enabled: batchesFor != null,
  });

  function invalidateBatches() {
    queryClient.invalidateQueries({ queryKey: ["batches-for-medicine", batchesFor?.id] });
    queryClient.invalidateQueries({ queryKey: ["medicines"] });
    queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
  }

  function openAddBatchFor() {
    setEditingBatch(null);
    setBatchDialogOpen(true);
  }

  function openEditBatchFor(b: EditableBatch) {
    setEditingBatch(b);
    setBatchDialogOpen(true);
  }

  function openAdd() {
    setEditingId(null);
    setForm(emptyMedicine);
    setAddOpen(true);
  }

  function openEdit(m: NonNullable<typeof data>[number]) {
    setEditingId(m.id);
    const halfGst = m.gstPercent / 2;
    setForm({
      name: m.name,
      company: m.company ?? "",
      category: m.category ?? "",
      pack: m.pack ?? "",
      mrp: m.mrp,
      sellingPrice: m.sellingPrice,
      purchasePrice: m.purchasePrice,
      cgstPercent: halfGst,
      sgstPercent: halfGst,
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
    const halfGst = item.gstPercent / 2;
    setForm((f) => ({
      ...f,
      name: item.name.toUpperCase(),
      company: item.company,
      category: item.category,
      pack: item.pack.toUpperCase(),
      hsnCode: item.hsnCode,
      cgstPercent: halfGst,
      sgstPercent: halfGst,
    }));
    setCatalogOpen(false);
    toast.success(`Filled details for ${item.brand}. Add your pricing to finish.`);
  }

  const saveMutation = useMutation({
    mutationFn: () => {
      const { cgstPercent, sgstPercent, ...rest } = form;
      return upsertMedicine({
        data: { ...rest, gstPercent: cgstPercent + sgstPercent, id: editingId ?? undefined },
      });
    },
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
        <div className="flex gap-2">
        <Button variant="outline" onClick={() => setAddBatchOpen(true)}>
          <CalendarClock className="h-4 w-4" /> Add Batch
        </Button>
        <Button variant="outline" onClick={() => setAddExpiryOpen(true)}>
          <CalendarPlus className="h-4 w-4" /> Add Expiry
        </Button>
        <ImportCsvDialog
          entityName="Medicine"
          columns={MEDICINE_IMPORT_COLUMNS}
          onImport={(rows) => bulkImportMedicines({ data: { rows } })}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["medicines"] })}
        />
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
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value.toUpperCase() })}
                    />
                  </F>
                  <F label="Manufacturer Name">
                    <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
                  </F>
                  <F label="Medicine Type">
                    <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select medicine type" />
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
                      placeholder="e.g. 10S, 200ML"
                      value={form.pack}
                      onChange={(e) => setForm({ ...form, pack: e.target.value.toUpperCase() })}
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
                  <F label={`Total GST: ${(form.cgstPercent + form.sgstPercent).toFixed(2)}%`}>
                    <p className="pt-2 text-xs text-muted-foreground">CGST + SGST, applied on intra-state sales.</p>
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
                        <Input
                          value={form.batchNo}
                          onChange={(e) => setForm({ ...form, batchNo: e.target.value.toUpperCase() })}
                        />
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
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative max-w-md flex-1 basis-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by medicine, manufacturer, or barcode…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative max-w-xs flex-1 basis-48">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by batch number…"
            value={batchSearch}
            onChange={(e) => setBatchSearch(e.target.value)}
          />
        </div>
        <Select
          value={supplierFilter?.toString() ?? "all"}
          onValueChange={(v) => setSupplierFilter(v === "all" ? undefined : Number(v))}
        >
          <SelectTrigger className="max-w-xs flex-1 basis-48">
            <SelectValue placeholder="All suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers?.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Pack</TableHead>
                <TableHead>Batch No.</TableHead>
                <TableHead>Manufacturer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">GST%</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Available Qty</TableHead>
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
                  <TableCell className="text-muted-foreground">{m.pack || "—"}</TableCell>
                  <TableCell>
                    {m.primaryBatchNo ? (
                      <span className="inline-flex items-center gap-1">
                        {m.primaryBatchNo}
                        {m.otherBatchCount > 0 && (
                          <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                            +{m.otherBatchCount}
                          </span>
                        )}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>{m.company || "—"}</TableCell>
                  <TableCell>{m.category || "—"}</TableCell>
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
                        title="View / edit batches &amp; expiry"
                        onClick={(e) => {
                          e.stopPropagation();
                          setBatchesFor({ id: m.id, name: m.name, pack: m.pack });
                        }}
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
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

      <Dialog open={!!batchesFor} onOpenChange={(open) => !open && setBatchesFor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Batches &amp; Expiry — {batchesFor?.name}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Edit or delete a batch here if what's recorded doesn't match what's actually on the shelf — e.g. a
            different batch was sold than the one the system picked.
          </p>
          <div className="flex justify-end">
            <Button size="sm" onClick={openAddBatchFor}>
              <Plus className="h-4 w-4" /> Add Batch
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch No.</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">MRP ₹</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchesForMedicine?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                    No batches recorded yet.
                  </TableCell>
                </TableRow>
              )}
              {batchesForMedicine?.map((b) => (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.batchNo}</TableCell>
                  <TableCell>{formatDate(b.expiryDate)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={b.quantity === 0 ? "destructive" : b.quantity <= 10 ? "secondary" : "outline"}>
                      {b.quantity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">{formatInr(b.mrp)}</TableCell>
                  <TableCell>{b.supplierName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Add expiry stock"
                        onClick={() => setExpiryQtyTarget({ id: b.id, batchNo: b.batchNo, mrp: b.mrp, quantity: b.quantity })}
                      >
                        <CalendarPlus className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditBatchFor(b)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteBatchTarget({ id: b.id, batchNo: b.batchNo })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      <BatchEditDialog
        open={batchDialogOpen}
        onOpenChange={setBatchDialogOpen}
        medicineId={batchesFor?.id ?? 0}
        batch={editingBatch}
        suppliers={suppliers}
        onSaved={invalidateBatches}
      />
      <DeleteBatchDialog
        batch={deleteBatchTarget}
        onOpenChange={(open) => !open && setDeleteBatchTarget(null)}
        onDeleted={invalidateBatches}
      />
      <AddBatchDialog
        open={addBatchOpen}
        onOpenChange={setAddBatchOpen}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["medicines"] });
          queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
        }}
      />
      <AddExpiryStockDialog
        open={addExpiryOpen}
        onOpenChange={setAddExpiryOpen}
        onSaved={() => {
          // The medicine picked here is independent of `batchesFor`, so invalidate every
          // batch list rather than just the one the row dialog last opened.
          queryClient.invalidateQueries({ queryKey: ["batches-for-medicine"] });
          queryClient.invalidateQueries({ queryKey: ["medicines"] });
          queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
        }}
      />
      <AddExpiryQuantityDialog
        open={!!expiryQtyTarget}
        onOpenChange={(open) => !open && setExpiryQtyTarget(null)}
        medicineId={batchesFor?.id ?? 0}
        medicineName={batchesFor?.name ?? ""}
        pack={batchesFor?.pack}
        batch={expiryQtyTarget}
        onSaved={invalidateBatches}
      />
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
