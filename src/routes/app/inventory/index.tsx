import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search } from "lucide-react";
import { listMedicines, upsertMedicine, getMedicineWithBatches } from "@/lib/api/medicines.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDate, formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/inventory/")({
  component: Inventory,
});

const emptyMedicine = {
  name: "",
  salt: "",
  brand: "",
  company: "",
  category: "",
  mrp: 0,
  sellingPrice: 0,
  purchasePrice: 0,
  gstPercent: 12,
  hsnCode: "",
  barcode: "",
  storage: "",
  schedule: "",
  rackNumber: "",
};

function Inventory() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyMedicine);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["medicines", search],
    queryFn: () => listMedicines({ data: { search } }),
  });

  const { data: detail } = useQuery({
    queryKey: ["medicine-detail", selectedId],
    queryFn: () => getMedicineWithBatches({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });

  const createMutation = useMutation({
    mutationFn: () => upsertMedicine({ data: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medicines"] });
      setAddOpen(false);
      setForm(emptyMedicine);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Inventory</h1>
          <p className="text-sm text-muted-foreground">Medicine master and batch-level stock.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add Medicine
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Medicine</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <F label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </F>
              <F label="Salt">
                <Input value={form.salt} onChange={(e) => setForm({ ...form, salt: e.target.value })} />
              </F>
              <F label="Brand">
                <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
              </F>
              <F label="Company">
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              </F>
              <F label="Category">
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
              </F>
              <F label="Schedule">
                <Input value={form.schedule} onChange={(e) => setForm({ ...form, schedule: e.target.value })} />
              </F>
              <F label="MRP">
                <Input type="number" value={form.mrp} onChange={(e) => setForm({ ...form, mrp: Number(e.target.value) })} />
              </F>
              <F label="Selling Price">
                <Input
                  type="number"
                  value={form.sellingPrice}
                  onChange={(e) => setForm({ ...form, sellingPrice: Number(e.target.value) })}
                />
              </F>
              <F label="Purchase Price">
                <Input
                  type="number"
                  value={form.purchasePrice}
                  onChange={(e) => setForm({ ...form, purchasePrice: Number(e.target.value) })}
                />
              </F>
              <F label="GST %">
                <Input
                  type="number"
                  value={form.gstPercent}
                  onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })}
                />
              </F>
              <F label="HSN Code">
                <Input value={form.hsnCode} onChange={(e) => setForm({ ...form, hsnCode: e.target.value })} />
              </F>
              <F label="Barcode">
                <Input value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} />
              </F>
              <F label="Rack Number">
                <Input value={form.rackNumber} onChange={(e) => setForm({ ...form, rackNumber: e.target.value })} />
              </F>
              <F label="Storage">
                <Input value={form.storage} onChange={(e) => setForm({ ...form, storage: e.target.value })} />
              </F>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
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
          placeholder="Search by medicine, salt, company, or barcode…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead>Salt</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead>Rack</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {data?.map((m) => (
                <TableRow key={m.id} className="cursor-pointer" onClick={() => setSelectedId(m.id)}>
                  <TableCell className="font-medium">{m.name}</TableCell>
                  <TableCell>{m.salt || "—"}</TableCell>
                  <TableCell>{m.company || "—"}</TableCell>
                  <TableCell>{m.category || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(m.mrp)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={m.totalStock === 0 ? "destructive" : m.totalStock <= 10 ? "secondary" : "outline"}>
                      {m.totalStock}
                    </Badge>
                  </TableCell>
                  <TableCell>{m.rackNumber || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{detail?.medicine?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                <span>MRP: {formatInr(detail.medicine.mrp)}</span>
                <span>Purchase: {formatInr(detail.medicine.purchasePrice)}</span>
                <span>Rack: {detail.medicine.rackNumber || "—"}</span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.batches.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No batches recorded
                      </TableCell>
                    </TableRow>
                  )}
                  {detail.batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.batchNo}</TableCell>
                      <TableCell>{formatDate(b.expiryDate)}</TableCell>
                      <TableCell className="text-right">{b.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatInr(b.mrp)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
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
