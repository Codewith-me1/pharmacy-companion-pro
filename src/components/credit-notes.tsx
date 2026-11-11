import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, Paperclip, Trash2 } from "lucide-react";
import {
  createCreditNote,
  deleteCreditNote,
  getCreditNoteFile,
  type listCreditNotes,
} from "@/lib/api/credit-notes.functions";
import { fileToBase64 } from "@/lib/file-to-base64";
import { formatDate, formatInr, toDateInputValue } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CreditNoteRow = Awaited<ReturnType<typeof listCreditNotes>>[number];

// Expiry stock of the supplier, offered for ticking as "covered by this note".
export type CreditNoteBatchOption = {
  id: number;
  medicineName: string;
  batchNo: string;
  quantity: number;
  expiredQuantity: number;
  expiredValue: number;
  estimatedLoss: number;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Records a credit note a supplier issued against returned expiry stock. Its amount is then
// deducted automatically from that supplier's next purchase bill (see purchases/new.tsx).
type CreditNoteDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  suppliers: { id: number; name: string }[] | undefined;
  /** Preselects the supplier (opened from that supplier's expiry card). */
  supplierId?: number;
  batches?: CreditNoteBatchOption[];
  onSaved: () => void;
};

export function CreditNoteDialog(props: CreditNoteDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* Mounted only while open, so every opening starts from a fresh form. */}
      {props.open && <CreditNoteForm {...props} />}
    </Dialog>
  );
}

function CreditNoteForm({
  onOpenChange,
  suppliers,
  supplierId,
  batches = [],
  onSaved,
}: CreditNoteDialogProps) {
  const [form, setForm] = useState(() => {
    // Start with every written-off batch ticked and the amount at their value — the usual case is
    // a credit note covering exactly the expiry stock that was sent back. With nothing written
    // off (e.g. opened from a single expired row still on the shelf), tick what was passed in and
    // use its stock value instead.
    const written = batches.filter((b) => b.expiredQuantity > 0);
    const preselected = written.length > 0 ? written : batches.length === 1 ? batches : [];
    const value = (b: CreditNoteBatchOption) =>
      b.expiredQuantity > 0 ? b.expiredValue : b.estimatedLoss;
    return {
      supplierId,
      noteNumber: "",
      noteDate: toDateInputValue(new Date()),
      amount: Math.round(preselected.reduce((sum, b) => sum + value(b), 0) * 100) / 100,
      reason: "",
      batchIds: preselected.map((b) => b.id),
      file: null as File | null,
    };
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let file: { name: string; mimeType: string; base64: string } | undefined;
      if (form.file) {
        const { base64, mimeType } = await fileToBase64(form.file);
        file = { name: form.file.name, mimeType, base64 };
      }
      return createCreditNote({
        data: {
          supplierId: form.supplierId!,
          noteNumber: form.noteNumber || undefined,
          noteDate: form.noteDate || undefined,
          amount: form.amount,
          reason: form.reason || undefined,
          batchIds: form.batchIds,
          file,
        },
      });
    },
    onSuccess: () => {
      toast.success(
        "Credit note saved — it will be deducted from this supplier's next purchase bill.",
      );
      onOpenChange(false);
      onSaved();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to save credit note."),
  });

  function toggleBatch(id: number, checked: boolean) {
    setForm((f) => ({
      ...f,
      batchIds: checked ? [...f.batchIds, id] : f.batchIds.filter((b) => b !== id),
    }));
  }

  return (
    <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Add Supplier Credit Note</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">
        Record the credit note the supplier gave for returned expiry stock. Its amount is deducted
        from the next purchase bill entered for the same supplier.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Supplier</Label>
          <Select
            value={form.supplierId?.toString() ?? ""}
            onValueChange={(v) => setForm({ ...form, supplierId: Number(v) })}
            disabled={supplierId != null}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select supplier" />
            </SelectTrigger>
            <SelectContent>
              {suppliers?.map((s) => (
                <SelectItem key={s.id} value={s.id.toString()}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <F label="Credit Note Number">
          <Input
            value={form.noteNumber}
            onChange={(e) => setForm({ ...form, noteNumber: e.target.value.toUpperCase() })}
          />
        </F>
        <F label="Credit Note Date">
          <DateInput value={form.noteDate} onChange={(v) => setForm({ ...form, noteDate: v })} />
        </F>
        <F label="Amount ₹">
          <Input
            type="number"
            placeholder="0"
            value={form.amount || ""}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          />
        </F>
        <F label="Credit Note Copy (photo or PDF)">
          <Input
            type="file"
            accept="image/*,.pdf,application/pdf"
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (file && file.size > MAX_FILE_BYTES) {
                toast.error("File is too large — keep it under 5 MB.");
                e.target.value = "";
                return;
              }
              setForm({ ...form, file });
            }}
          />
        </F>
        <div className="col-span-2">
          <F label="Notes (optional)">
            <Textarea
              rows={2}
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Expiry return sent 02/11"
            />
          </F>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="flex flex-col gap-1">
          <Label className="text-xs text-muted-foreground">Expiry stock covered by this note</Label>
          <div className="max-h-48 overflow-y-auto rounded-md border border-border">
            {batches.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 text-sm last:border-0"
              >
                <Checkbox
                  checked={form.batchIds.includes(b.id)}
                  onCheckedChange={(v) => toggleBatch(b.id, !!v)}
                />
                <span className="flex-1">
                  {b.medicineName}{" "}
                  <span className="text-xs text-muted-foreground">· {b.batchNo}</span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {b.expiredQuantity > 0
                    ? `${b.expiredQuantity} written off`
                    : `${b.quantity} on shelf`}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <DialogFooter>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={!form.supplierId || !(form.amount > 0) || saveMutation.isPending}
        >
          Save Credit Note
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function noteStatus(note: CreditNoteRow) {
  if (note.remaining <= 0) return <Badge variant="secondary">Fully used</Badge>;
  if (note.appliedAmount > 0) return <Badge variant="outline">Partly used</Badge>;
  return <Badge className="bg-emerald-600 hover:bg-emerald-600">Open</Badge>;
}

async function openNoteFile(id: number) {
  try {
    const file = await getCreditNoteFile({ data: { id } });
    const bytes = Uint8Array.from(atob(file.fileData!), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(
      new Blob([bytes], { type: file.fileMimeType ?? "application/octet-stream" }),
    );
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Couldn't open the credit note file.");
  }
}

export function CreditNotesTable({
  notes,
  showSupplier = true,
  onChanged,
}: {
  notes: CreditNoteRow[];
  showSupplier?: boolean;
  onChanged: () => void;
}) {
  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteCreditNote({ data: { id } }),
    onSuccess: () => {
      toast.success("Credit note deleted.");
      onChanged();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Failed to delete credit note."),
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Credit Note</TableHead>
          {showSupplier && <TableHead>Supplier</TableHead>}
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-right">Deducted</TableHead>
          <TableHead className="text-right">Remaining</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {notes.length === 0 && (
          <TableRow>
            <TableCell
              colSpan={showSupplier ? 8 : 7}
              className="p-8 text-center text-muted-foreground"
            >
              No credit notes recorded yet.
            </TableCell>
          </TableRow>
        )}
        {notes.map((note) => (
          <TableRow key={note.id}>
            <TableCell>
              <div className="font-medium">{note.noteNumber || `#${note.id}`}</div>
              {note.applications.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  Deducted from{" "}
                  {note.applications
                    .map(
                      (a) =>
                        `${a.invoiceNumber ? `inv ${a.invoiceNumber}` : `purchase #${a.purchaseId}`} (${formatInr(a.amount)})`,
                    )
                    .join(", ")}
                </div>
              )}
              {note.reason && <div className="text-xs text-muted-foreground">{note.reason}</div>}
            </TableCell>
            {showSupplier && <TableCell>{note.supplierName}</TableCell>}
            <TableCell>{formatDate(note.noteDate)}</TableCell>
            <TableCell className="text-right font-mono">{formatInr(note.amount)}</TableCell>
            <TableCell className="text-right font-mono">
              {note.appliedAmount > 0 ? formatInr(note.appliedAmount) : "—"}
            </TableCell>
            <TableCell className="text-right font-mono">{formatInr(note.remaining)}</TableCell>
            <TableCell>{noteStatus(note)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-1">
                {note.hasFile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    title={`View ${note.fileName}`}
                    onClick={() => openNoteFile(note.id)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                {!note.hasFile && (
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center text-muted-foreground/40"
                    title="No file attached"
                  >
                    <Paperclip className="h-4 w-4" />
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  title={
                    note.appliedAmount > 0
                      ? "Already deducted from a purchase — can't delete"
                      : "Delete"
                  }
                  disabled={note.appliedAmount > 0 || deleteMutation.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete credit note ${note.noteNumber || `#${note.id}`}?`))
                      deleteMutation.mutate(note.id);
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
