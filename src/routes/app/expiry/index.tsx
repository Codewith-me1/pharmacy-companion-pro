import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, Download, IndianRupee, PackageX, Pencil, Plus, Search, SearchCheck, Trash2, Truck } from "lucide-react";
import { getExpiryDashboard } from "@/lib/api/expiry.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { listMedicines } from "@/lib/api/medicines.functions";
import { listSuppliers } from "@/lib/api/suppliers.functions";
import { createBatch } from "@/lib/api/stock.functions";
import { BatchEditDialog, DeleteBatchDialog, type EditableBatch } from "@/components/batch-dialogs";
import { printSupplierReturnReport } from "@/lib/print-supplier-report";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { formatDate, formatInr } from "@/lib/format";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/expiry/")({
  component: ExpiryPage,
});

function useExpiryData() {
  return useQuery({ queryKey: ["expiry-dashboard"], queryFn: () => getExpiryDashboard() });
}

function matchesSearch(row: { medicineName: string; batchNo: string; supplierName: string | null }, search: string) {
  if (!search) return true;
  const term = search.toLowerCase();
  return (
    row.medicineName.toLowerCase().includes(term) ||
    row.batchNo.toLowerCase().includes(term) ||
    (row.supplierName ?? "").toLowerCase().includes(term)
  );
}

const emptyExpiryForm = {
  medicineId: undefined as number | undefined,
  medicineLabel: "",
  batchNo: "",
  quantity: 0,
  expiryDate: "",
  manufactureDate: "",
  purchasePrice: 0,
  mrp: 0,
  supplierId: undefined as number | undefined,
};

function ExpiryPage() {
  const { data, isLoading } = useExpiryData();
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });
  const { data: suppliers } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  const [addOpen, setAddOpen] = useState(false);
  const [medicinePickerOpen, setMedicinePickerOpen] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");
  const [form, setForm] = useState(emptyExpiryForm);
  const { data: medicineResults } = useQuery({
    queryKey: ["medicines", medicineSearch],
    queryFn: () => listMedicines({ data: { search: medicineSearch } }),
    enabled: medicinePickerOpen,
  });

  const addExpiryMutation = useMutation({
    mutationFn: () =>
      createBatch({
        data: {
          medicineId: form.medicineId!,
          batchNo: form.batchNo,
          expiryDate: form.expiryDate,
          manufactureDate: form.manufactureDate || undefined,
          quantity: form.quantity,
          purchasePrice: form.purchasePrice,
          mrp: form.mrp,
          supplierId: form.supplierId,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
      toast.success("Batch added to expiry tracking.");
      setAddOpen(false);
      setForm(emptyExpiryForm);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add batch."),
  });

  const [editingRow, setEditingRow] = useState<{ medicineId: number; medicineName: string; batch: EditableBatch } | null>(null);
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; batchNo: string } | null>(null);

  if (isLoading || !data) {
    return <div className="text-sm text-muted-foreground">Loading expiry dashboard…</div>;
  }

  type ExpiryRow = (typeof data.all)[number];

  function openEditRow(item: ExpiryRow) {
    setEditingRow({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      batch: {
        id: item.id,
        batchNo: item.batchNo,
        quantity: item.quantity,
        expiryDate: item.expiryDate,
        manufactureDate: item.manufactureDate,
        purchasePrice: item.purchasePrice,
        mrp: item.mrp,
        supplierId: item.supplierId,
      },
    });
    setRowDialogOpen(true);
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["expiry-dashboard"] });
  }

  const filteredBySupplier = data.bySupplier
    .map((s) => ({ ...s, items: s.items.filter((i) => matchesSearch(i, search)) }))
    .filter((s) => s.items.length > 0);
  const filteredExpired = data.expired.filter((i) => matchesSearch(i, search));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Expiry Management</h1>
          <p className="text-sm text-muted-foreground">Stay ahead of expiring stock and minimise write-offs.</p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={addOpen}
            onOpenChange={(open) => {
              setAddOpen(open);
              if (!open) {
                setForm(emptyExpiryForm);
                setMedicineSearch("");
              }
            }}
          >
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Expiry Entry
            </Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Expiry / Batch Entry</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                Use this when stock that was never entered into the system turns up expired (or close to
                it) — e.g. records kept only on paper, or a batch sold right on its expiry day that never
                matched what's here. This creates the batch directly; the expiry date can be in the past.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground">Medicine</Label>
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
                                  setForm((f) => ({
                                    ...f,
                                    medicineId: m.id,
                                    medicineLabel: m.pack ? `${m.name} (${m.pack})` : m.name,
                                    purchasePrice: m.purchasePrice,
                                    mrp: m.mrp,
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
                <F label="Batch Number">
                  <Input
                    value={form.batchNo}
                    onChange={(e) => setForm({ ...form, batchNo: e.target.value.toUpperCase() })}
                  />
                </F>
                <F label="Quantity">
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
                  onClick={() => addExpiryMutation.mutate()}
                  disabled={!form.medicineId || !form.batchNo || !form.expiryDate || addExpiryMutation.isPending}
                >
                  Add Entry
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" onClick={() => window.print()}>
            Print Expiry Report
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Expiring This Month"
          value={String(data.expiringThisMonthCount)}
          icon={AlertTriangle}
          tone="warning"
        />
        <StatCard label="Estimated Loss (30 days)" value={formatInr(data.totalEstimatedLoss)} icon={IndianRupee} tone="danger" />
        <StatCard label="Already Expired" value={String(data.expired.length)} sub="batches" icon={AlertTriangle} tone="danger" />
        <StatCard
          label="Expiry Stock Written Off"
          value={String(data.totalExpiredQuantity)}
          sub={`units · ${formatInr(data.totalExpiredValue)} to recover`}
          icon={PackageX}
          tone="danger"
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by medicine, batch, or supplier…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="30">
        <TabsList className="flex-wrap">
          <TabsTrigger value="expired">Expired ({filteredExpired.length})</TabsTrigger>
          {data.buckets.map((b) => (
            <TabsTrigger key={b.days} value={String(b.days)}>
              {b.days} Days ({b.items.filter((i) => matchesSearch(i, search)).length})
            </TabsTrigger>
          ))}
          <TabsTrigger value="supplier">By Supplier ({filteredBySupplier.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="expired">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Days Expired</TableHead>
                    <TableHead className="text-right">On Shelf</TableHead>
                    <TableHead className="text-right">Written Off</TableHead>
                    <TableHead className="text-right">Est. Loss</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpired.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="p-8 text-center text-muted-foreground">
                        Nothing already expired — or it's already been cleared out.
                      </TableCell>
                    </TableRow>
                  )}
                  {filteredExpired.map((item) => (
                    <TableRow key={item.id} className="bg-destructive/5">
                      <TableCell className="font-medium">{item.medicineName}</TableCell>
                      <TableCell>{item.batchNo}</TableCell>
                      <TableCell>{item.supplierName || "—"}</TableCell>
                      <TableCell>{formatDate(item.expiryDate)}</TableCell>
                      <TableCell className="text-right">
                        {item.daysToExpiry < 0 ? (
                          <Badge variant="destructive">{Math.abs(item.daysToExpiry)}d ago</Badge>
                        ) : (
                          <Badge variant="secondary">written off early</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {item.expiredQuantity > 0 ? (
                          <Badge variant="destructive">{item.expiredQuantity}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono">{formatInr(item.estimatedLoss)}</TableCell>
                      <TableCell className="text-right">
                        <RowActions onEdit={() => openEditRow(item)} onDelete={() => setDeleteTarget({ id: item.id, batchNo: item.batchNo })} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {data.buckets.map((bucket) => {
          const items = bucket.items.filter((i) => matchesSearch(i, search));
          return (
            <TabsContent key={bucket.days} value={String(bucket.days)}>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="text-right">Days Left</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Est. Loss</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="p-8 text-center text-muted-foreground">
                            Nothing expiring in this window.
                          </TableCell>
                        </TableRow>
                      )}
                      {items.map((item) => (
                        <TableRow key={item.id} className={cn(item.daysToExpiry <= 7 && "bg-destructive/5")}>
                          <TableCell className="font-medium">{item.medicineName}</TableCell>
                          <TableCell>{item.batchNo}</TableCell>
                          <TableCell>{item.supplierName || "—"}</TableCell>
                          <TableCell>{formatDate(item.expiryDate)}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={item.daysToExpiry <= 7 ? "destructive" : "secondary"}>
                              {item.daysToExpiry}d
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right font-mono">{formatInr(item.estimatedLoss)}</TableCell>
                          <TableCell className="text-right">
                            <RowActions onEdit={() => openEditRow(item)} onDelete={() => setDeleteTarget({ id: item.id, batchNo: item.batchNo })} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}

        <TabsContent value="supplier">
          <div className="flex flex-col gap-4">
            {filteredBySupplier.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No expiring stock matches this search, grouped by supplier.
                </CardContent>
              </Card>
            )}
            {filteredBySupplier.map((supplier) => (
              <Card key={supplier.supplierId ?? "unknown"}>
                <CardContent className="flex flex-col gap-3 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      <Truck className="h-4 w-4 text-muted-foreground" />
                      {supplier.supplierName}
                      <Badge variant="secondary">{supplier.items.length} expiring</Badge>
                      {supplier.expiredQuantity > 0 && (
                        <Badge variant="destructive">{supplier.expiredQuantity} expired units</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Est. loss {formatInr(supplier.estimatedLoss)}
                        {supplier.expiredValue > 0 && ` · ${formatInr(supplier.expiredValue)} expired`}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          printSupplierReturnReport({
                            firmName: business?.firmName,
                            dlNo: business?.dlNo,
                            mobile: business?.mobile,
                            supplierName: supplier.supplierName,
                            items: supplier.items.map((i) => ({
                              medicineName: i.medicineName,
                              pack: i.pack,
                              quantity: i.expiredQuantity > 0 ? i.expiredQuantity : i.quantity,
                              batchNo: i.batchNo,
                              expiryDate: i.expiryDate,
                              mrp: i.mrp,
                            })),
                          })
                        }
                      >
                        <Download className="h-3.5 w-3.5" /> Download Report
                      </Button>
                    </div>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Medicine</TableHead>
                        <TableHead>Batch</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead className="text-right">On Shelf</TableHead>
                        <TableHead className="text-right">Written Off</TableHead>
                        <TableHead className="text-right">MRP</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {supplier.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell>{item.medicineName}</TableCell>
                          <TableCell>{item.batchNo}</TableCell>
                          <TableCell>{formatDate(item.expiryDate)}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">
                            {item.expiredQuantity > 0 ? (
                              <Badge variant="destructive">{item.expiredQuantity}</Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatInr(item.mrp)}</TableCell>
                          <TableCell className="text-right">
                            <RowActions onEdit={() => openEditRow(item)} onDelete={() => setDeleteTarget({ id: item.id, batchNo: item.batchNo })} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <BatchEditDialog
        open={rowDialogOpen}
        onOpenChange={setRowDialogOpen}
        medicineId={editingRow?.medicineId ?? 0}
        medicineLabel={editingRow?.medicineName}
        batch={editingRow?.batch}
        suppliers={suppliers}
        onSaved={invalidate}
      />
      <DeleteBatchDialog batch={deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)} onDeleted={invalidate} />
    </div>
  );
}

function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex justify-end gap-1">
      <Button variant="ghost" size="icon" onClick={onEdit}>
        <Pencil className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onDelete}>
        <Trash2 className="h-4 w-4" />
      </Button>
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
