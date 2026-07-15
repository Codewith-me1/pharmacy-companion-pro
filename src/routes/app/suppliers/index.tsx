import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { listSuppliers, upsertSupplier, deleteSupplier } from "@/lib/api/suppliers.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
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

export const Route = createFileRoute("/app/suppliers/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SuppliersPage,
});

const empty = { name: "", gstNumber: "", dlNo: "", address: "", phone: "", creditDays: 30, outstanding: 0 };

function SuppliersPage() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState(empty);

  const { data, isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => listSuppliers() });
  const filtered = useMemo(
    () => (data ?? []).filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );

  function openAdd() {
    setEditingId(null);
    setForm(empty);
    setAddOpen(true);
  }

  function openEdit(s: NonNullable<typeof data>[number]) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      gstNumber: s.gstNumber ?? "",
      dlNo: s.dlNo ?? "",
      address: s.address ?? "",
      phone: s.phone ?? "",
      creditDays: s.creditDays,
      outstanding: s.outstanding,
    });
    setAddOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertSupplier({ data: { ...form, id: editingId ?? undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success(editingId ? "Supplier updated." : "Supplier added.");
      setAddOpen(false);
      setEditingId(null);
      setForm(empty);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save supplier."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteSupplier({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      toast.success("Supplier deleted.");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete — it may have batches or purchases linked to it.");
      setDeleteTarget(null);
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">Supplier directory, credit terms and purchase history.</p>
        </div>
        <Dialog
          open={addOpen}
          onOpenChange={(open) => {
            setAddOpen(open);
            if (!open) {
              setEditingId(null);
              setForm(empty);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add Supplier
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Supplier" : "Add Supplier"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </F>
              <F label="GST Number">
                <Input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })} />
              </F>
              <F label="D.L. No">
                <Input value={form.dlNo} onChange={(e) => setForm({ ...form, dlNo: e.target.value })} />
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
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                Save Supplier
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search suppliers…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>GST</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Credit Days</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    No suppliers match your search.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((s, i) => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => navigate({ to: "/app/suppliers/$supplierId", params: { supplierId: String(s.id) } })}
                >
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
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
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(s);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: s.id, name: s.name });
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
              This cannot be undone. If this supplier has batches or purchases linked to it, deletion will be
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
