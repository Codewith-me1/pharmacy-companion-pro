import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  listDoctors,
  upsertDoctor,
  deleteDoctor,
  getDoctorWithMedicines,
  addDoctorFavoriteMedicine,
  removeDoctorFavoriteMedicine,
} from "@/lib/api/doctors.functions";
import { listMedicines } from "@/lib/api/medicines.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export const Route = createFileRoute("/app/doctors/")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: DoctorsPage,
});

const empty = { name: "", hospital: "", clinic: "", phone: "", licenseNumber: "", specialization: "" };

function DoctorsPage() {
  const { q } = Route.useSearch();
  const [search, setSearch] = useState(q);
  useEffect(() => setSearch(q), [q]);
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(null);
  const [form, setForm] = useState(empty);
  const [newMedId, setNewMedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["doctors"], queryFn: () => listDoctors() });
  const filtered = useMemo(
    () => (data ?? []).filter((d) => !search || d.name.toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );
  const { data: medicines } = useQuery({ queryKey: ["medicines", ""], queryFn: () => listMedicines() });
  const { data: detail } = useQuery({
    queryKey: ["doctor-detail", selectedId],
    queryFn: () => getDoctorWithMedicines({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });

  function openAdd() {
    setEditingId(null);
    setForm(empty);
    setAddOpen(true);
  }

  function openEdit(d: NonNullable<typeof data>[number]) {
    setEditingId(d.id);
    setForm({
      name: d.name,
      hospital: d.hospital ?? "",
      clinic: d.clinic ?? "",
      phone: d.phone ?? "",
      licenseNumber: d.licenseNumber ?? "",
      specialization: d.specialization ?? "",
    });
    setAddOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: () => upsertDoctor({ data: { ...form, id: editingId ?? undefined } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success(editingId ? "Doctor updated." : "Doctor added.");
      setAddOpen(false);
      setEditingId(null);
      setForm(empty);
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to save doctor."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteDoctor({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      toast.success("Doctor deleted.");
      setDeleteTarget(null);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to delete — it may have sales linked to it.");
      setDeleteTarget(null);
    },
  });

  const addFavMutation = useMutation({
    mutationFn: () => addDoctorFavoriteMedicine({ data: { doctorId: selectedId!, medicineId: newMedId! } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctor-detail", selectedId] });
      setNewMedId(null);
    },
  });

  const removeFavMutation = useMutation({
    mutationFn: (id: number) => removeDoctorFavoriteMedicine({ data: { id } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["doctor-detail", selectedId] }),
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Doctors</h1>
          <p className="text-sm text-muted-foreground">
            Doctor database with prescription templates — pick a doctor's favourites fast at billing time.
          </p>
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
              <Plus className="h-4 w-4" /> Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit Doctor" : "Add Doctor"}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <F label="Name">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </F>
              <F label="Specialization">
                <Input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} />
              </F>
              <F label="Hospital">
                <Input value={form.hospital} onChange={(e) => setForm({ ...form, hospital: e.target.value })} />
              </F>
              <F label="Clinic">
                <Input value={form.clinic} onChange={(e) => setForm({ ...form, clinic: e.target.value })} />
              </F>
              <F label="Phone">
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </F>
              <F label="License Number">
                <Input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })} />
              </F>
            </div>
            <DialogFooter>
              <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>
                Save Doctor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search doctors…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Specialization</TableHead>
                <TableHead>Hospital / Clinic</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                    No doctors match your search.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setSelectedId(d.id)}>
                  <TableCell className="font-medium">Dr. {d.name}</TableCell>
                  <TableCell>{d.specialization || "—"}</TableCell>
                  <TableCell>{d.hospital || d.clinic || "—"}</TableCell>
                  <TableCell>{d.phone || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          openEdit(d);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: d.id, name: d.name });
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

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Dr. {detail?.doctor?.name} — Favourite Medicines</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <Select value={newMedId?.toString() ?? ""} onValueChange={(v) => setNewMedId(Number(v))}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Add a favourite medicine…" />
                  </SelectTrigger>
                  <SelectContent>
                    {medicines?.map((m) => (
                      <SelectItem key={m.id} value={m.id.toString()}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button disabled={!newMedId} onClick={() => addFavMutation.mutate()}>
                  Add
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead className="text-right">Default Qty</TableHead>
                    <TableHead className="text-right">MRP</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.favorites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No favourites yet.
                      </TableCell>
                    </TableRow>
                  )}
                  {detail.favorites.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.medicineName}</TableCell>
                      <TableCell className="text-right">{f.defaultQty}</TableCell>
                      <TableCell className="text-right font-mono">{formatInr(f.mrp)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeFavMutation.mutate(f.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dr. {deleteTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This cannot be undone. If this doctor has sales linked to them, deletion will be blocked.
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
