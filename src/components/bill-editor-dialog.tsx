import { useState } from "react";
import { toast } from "sonner";
import { Printer, RotateCcw, Trash2 } from "lucide-react";
import {
  BILL_COLUMNS,
  BILL_SECTIONS,
  layoutFromSettings,
  printBill,
  type BillLayout,
  type PrintBillData,
  type PrintBillItem,
} from "@/lib/print-bill";
import { formatInr } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { DateInput } from "@/components/date-input";
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

// The last layout used, remembered per browser so a pharmacy that always prints plain bills
// without, say, the MRP column doesn't redo it for every bill. Best-effort only: storage can be
// unavailable (private mode, blocked site data) and the editor then starts from bill settings.
const LAYOUT_STORAGE_KEY = "bill-editor-layout";

function loadLayout(fallback: BillLayout): BillLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<BillLayout>;
    return {
      plain: !!parsed.plain,
      hiddenColumns: Array.isArray(parsed.hiddenColumns)
        ? parsed.hiddenColumns
        : fallback.hiddenColumns,
      hiddenSections: Array.isArray(parsed.hiddenSections)
        ? parsed.hiddenSections
        : fallback.hiddenSections,
    };
  } catch {
    return fallback;
  }
}

function saveLayout(layout: BillLayout) {
  try {
    localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
  } catch {
    /* storage unavailable — nothing to remember, printing still works */
  }
}

function toggle<T>(list: T[], value: T, on: boolean): T[] {
  return on ? list.filter((v) => v !== value) : [...list, value];
}

// Edit a sales bill's printout before printing: hide columns or whole sections, switch to a plain
// layout with no table lines, change or clear any field, and remove rows. This shapes the printed
// copy only — the saved sale, its total and the stock it took are not touched.
export function BillEditorDialog({
  bill,
  onOpenChange,
}: {
  bill: PrintBillData | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={bill != null} onOpenChange={onOpenChange}>
      {/* Keyed by bill so each one opens with its own fresh copy to edit. */}
      {bill && <BillEditor key={bill.billNumber} bill={bill} onDone={() => onOpenChange(false)} />}
    </Dialog>
  );
}

function BillEditor({ bill, onDone }: { bill: PrintBillData; onDone: () => void }) {
  const [draft, setDraft] = useState<PrintBillData>(bill);
  const [layout, setLayout] = useState<BillLayout>(() =>
    loadLayout(layoutFromSettings(bill.settings)),
  );

  function updateItem(index: number, patch: Partial<PrintBillItem>) {
    setDraft((d) => ({
      ...d,
      items: d.items.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    }));
  }

  function removeItem(index: number) {
    setDraft((d) => ({ ...d, items: d.items.filter((_, i) => i !== index) }));
  }

  const subtotal = draft.items.reduce((sum, i) => sum + i.rate * i.quantity, 0);
  const grandTotal = Math.round(subtotal - draft.discount);

  function handlePrint() {
    saveLayout(layout);
    try {
      printBill({ ...draft, layout });
      onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to print bill.");
    }
  }

  return (
    <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
      <DialogHeader>
        <DialogTitle>Edit Bill {bill.billNumber} before printing</DialogTitle>
      </DialogHeader>
      <p className="text-xs text-muted-foreground">
        Changes here apply to this printout only. The saved bill, its total and the stock it used
        stay as they are.
      </p>

      <section className="flex flex-col gap-3 rounded-md border border-border p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <Switch
              checked={layout.plain}
              onCheckedChange={(plain) => setLayout({ ...layout, plain })}
            />
            Plain layout: just the data, no table lines or boxes
          </label>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setLayout(layoutFromSettings(bill.settings))}
            title="Go back to the columns and sections set in Settings → Bill"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset to bill settings
          </Button>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Columns</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {BILL_COLUMNS.map((c) => {
              const on = !layout.hiddenColumns.includes(c.key);
              return (
                <label key={c.key} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={on}
                    onCheckedChange={() =>
                      setLayout({
                        ...layout,
                        hiddenColumns: toggle(layout.hiddenColumns, c.key, on),
                      })
                    }
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">Show on bill</Label>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {BILL_SECTIONS.map((sec) => {
              const on = !layout.hiddenSections.includes(sec.key);
              return (
                <label key={sec.key} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <Checkbox
                    checked={on}
                    onCheckedChange={() =>
                      setLayout({
                        ...layout,
                        hiddenSections: toggle(layout.hiddenSections, sec.key, on),
                      })
                    }
                  />
                  {sec.label}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <F label="Patient Name">
          <Input
            value={draft.customerName ?? ""}
            onChange={(e) => setDraft({ ...draft, customerName: e.target.value })}
          />
        </F>
        <F label="Patient Address">
          <Input
            value={draft.customerAddress ?? ""}
            onChange={(e) => setDraft({ ...draft, customerAddress: e.target.value })}
          />
        </F>
        <F label="Doctor">
          <Input
            value={draft.doctorName ?? ""}
            onChange={(e) => setDraft({ ...draft, doctorName: e.target.value })}
          />
        </F>
        <F label="Hospital">
          <Input
            value={draft.hospitalName ?? ""}
            onChange={(e) => setDraft({ ...draft, hospitalName: e.target.value })}
          />
        </F>
        <F label="Date (as printed)">
          <Input
            value={draft.createdAt}
            onChange={(e) => setDraft({ ...draft, createdAt: e.target.value })}
          />
        </F>
        <F label="Other Adj. / Discount ₹">
          <Input
            type="number"
            placeholder="0"
            value={draft.discount || ""}
            onChange={(e) => setDraft({ ...draft, discount: Number(e.target.value) })}
          />
        </F>
      </section>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Pack</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead>Exp.</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Rate ₹</TableHead>
            <TableHead>MRP ₹</TableHead>
            <TableHead className="text-right">Amount ₹</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {draft.items.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="p-6 text-center text-muted-foreground">
                All rows removed. Use "Undo all edits" to bring them back.
              </TableCell>
            </TableRow>
          )}
          {draft.items.map((item, i) => (
            <TableRow key={i}>
              <TableCell className="min-w-44">
                <Input
                  value={item.medicineName}
                  onChange={(e) => updateItem(i, { medicineName: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="w-20"
                  value={item.pack ?? ""}
                  onChange={(e) => updateItem(i, { pack: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="w-24"
                  value={item.batchNo ?? ""}
                  onChange={(e) => updateItem(i, { batchNo: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <DateInput
                  className="w-24"
                  mode="expiry"
                  value={item.expiryDate ?? ""}
                  onChange={(v) => updateItem(i, { expiryDate: v || null })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="w-16"
                  type="number"
                  placeholder="0"
                  value={item.quantity || ""}
                  onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="w-20"
                  type="number"
                  placeholder="0"
                  value={item.rate || ""}
                  onChange={(e) => updateItem(i, { rate: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell>
                <Input
                  className="w-20"
                  type="number"
                  placeholder="0"
                  value={item.mrp || ""}
                  onChange={(e) => updateItem(i, { mrp: Number(e.target.value) })}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                {(item.rate * item.quantity).toFixed(2)}
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Remove this row from the printout"
                  onClick={() => removeItem(i)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <DialogFooter className="flex-wrap items-center gap-2 sm:justify-between">
        <span className="text-sm">
          Printed total: <span className="font-mono font-semibold">{formatInr(grandTotal)}</span>
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setDraft(bill)}>
            <RotateCcw className="h-4 w-4" /> Undo all edits
          </Button>
          <Button onClick={handlePrint} disabled={draft.items.length === 0}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
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
