import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { listDoctors, upsertDoctor, getDoctorWithMedicines, addDoctorFavoriteMedicine, removeDoctorFavoriteMedicine } from "@/lib/api/doctors.functions";
import { listMedicines } from "@/lib/api/medicines.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { formatInr } from "@/lib/format";

export const Route = createFileRoute("/app/doctors/")({
  component: DoctorsPage,
});

const empty = { name: "", hospital: "", clinic: "", phone: "", licenseNumber: "", specialization: "" };

function DoctorsPage() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [form, setForm] = useState(empty);
  const [newMedId, setNewMedId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ["doctors"], queryFn: () => listDoctors() });
  const { data: medicines } = useQuery({ queryKey: ["medicines", ""], queryFn: () => listMedicines() });
  const { data: detail } = useQuery({
    queryKey: ["doctor-detail", selectedId],
    queryFn: () => getDoctorWithMedicines({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });

  const createMutation = useMutation({
    mutationFn: () => upsertDoctor({ data: form }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["doctors"] });
      setAddOpen(false);
      setForm(empty);
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
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" /> Add Doctor
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Doctor</DialogTitle>
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
              <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
                Save Doctor
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
                <TableHead>Specialization</TableHead>
                <TableHead>Hospital / Clinic</TableHead>
                <TableHead>Phone</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {data?.map((d) => (
                <TableRow key={d.id} className="cursor-pointer" onClick={() => setSelectedId(d.id)}>
                  <TableCell className="font-medium">Dr. {d.name}</TableCell>
                  <TableCell>{d.specialization || "—"}</TableCell>
                  <TableCell>{d.hospital || d.clinic || "—"}</TableCell>
                  <TableCell>{d.phone || "—"}</TableCell>
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
