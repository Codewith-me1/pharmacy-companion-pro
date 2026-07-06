import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { listSuppliers, upsertSupplier, getSupplier } from "@/lib/api/suppliers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatInr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/suppliers/")({
  component: SuppliersPage,
});

const empty = { name: "", gstNumber: "", address: "", phone: "", creditDays: 30, outstanding: 0 };

function SuppliersPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const { data: detail } = useQuery({
    queryKey: ["supplier-detail", selectedId],
    queryFn: () => getSupplier({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });

  const createMutation = useMutation({
    mutationFn: () => upsertSupplier({ data: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      setAddOpen(false);
      setForm(empty);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Supplier directory, credit terms and purchase history.</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Supplier</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </F>
              <F label="GST Number">
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </F>
              <F label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </F>
              <F label="Credit Days">
                <Input
                  type="number"
                  value={form.creditDays}
                  onChange={(e) => setForm({ ...form, creditDays: Number(e.target.value) })}
                />
              </F>
              <F label="Address">
                <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </F>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                Save Supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Credit Days</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {data?.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.gstNumber || "—"}</TableCell>
                  <TableCell>{s.phone || "—"}</TableCell>
                  <TableCell>{s.creditDays}</TableCell>
                  <TableCell className="text-right font-mono">
                    {s.outstanding > 0 ? (
                      <Badge variant="destructive">{formatInr(s.outstanding)}</Badge>
                    ) : (
                      formatInr(s.outstanding)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{detail?.supplier?.name}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">{detail.supplier.address}</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.purchaseHistory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No purchase history
                      </TableCell>
                    </TableRow>
                  )}
                  {detail.purchaseHistory.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.invoiceNumber || "—"}</TableCell>
                      <TableCell>{formatDate(p.createdAt)}</TableCell>
                      <TableCell className="text-right font-mono">{formatInr(p.invoiceTotal)}</TableCell>
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
