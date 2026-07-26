import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, Mail, Plus, ScanLine, SearchCheck, SquarePen, Trash2 } from "lucide-react";
import { extractInvoice, savePurchase } from "@/lib/api/purchases.functions";
import { listMedicines } from "@/lib/api/medicines.functions";
import { fileToBase64 } from "@/lib/file-to-base64";
import { pdfToImageBlob } from "@/lib/pdf-to-image";
import { enhanceInvoiceImage } from "@/lib/enhance-image";
import { FetchEmailDialog } from "@/components/fetch-email-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/purchases/new")({
  component: NewPurchase,
});

type DraftItem = Awaited<ReturnType<typeof extractInvoice>>["draft"]["items"][number];
type Draft = Awaited<ReturnType<typeof extractInvoice>>["draft"];

const FLAG_LABELS: Record<string, string> = {
  wrong_expiry: "Wrong expiry",
  duplicate_batch: "Duplicate batch",
  existing_batch: "Existing batch",
  price_change: "Price changed",
  gst_mismatch: "GST mismatch",
  quantity_mismatch: "Qty issue",
  possible_duplicate_data: "Check vs photo — looks copied",
};

const emptyDraft: Draft = {
  supplier: { id: null, name: "", gstNumber: "", dlNo: "", address: "" },
  invoiceNumber: "",
  serialNumber: "",
  invoiceDate: "",
  billNumber: "",
  invoiceTotal: 0,
  netAmount: 0,
  taxAmount: 0,
  items: [],
  overallConfidence: 1,
};

function NewPurchase() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"capture" | "converting" | "enhancing" | "extracting" | "review">("capture");
  const [showEmailDialog, setShowEmailDialog] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sourceLabel, setSourceLabel] = useState<"camera" | "pdf" | "email" | "manual">("camera");
  const [saving, setSaving] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [medicineSearch, setMedicineSearch] = useState("");
  const { data: medicineResults } = useQuery({
    queryKey: ["medicines", medicineSearch],
    queryFn: () => listMedicines({ data: { search: medicineSearch } }),
    enabled: addItemOpen,
  });

  function startManualEntry() {
    setSourceLabel("manual");
    setDraft(emptyDraft);
    setStep("review");
  }

  function addManualItem(m: NonNullable<typeof medicineResults>[number]) {
    setDraft((d) => {
      const base = d ?? emptyDraft;
      return {
        ...base,
        items: [
          ...base.items,
          {
            medicineId: m.id,
            medicineNameRaw: m.name,
            pack: m.pack,
            batchNo: null,
            expiryDate: null,
            manufactureDate: null,
            hsnCode: m.hsnCode,
            mrp: m.mrp,
            ptr: 0,
            pts: 0,
            purchasePrice: m.purchasePrice,
            sellingPrice: m.sellingPrice,
            gstPercent: m.gstPercent,
            cgst: 0,
            sgst: 0,
            igst: 0,
            discount: 0,
            scheme: null,
            freeQty: 0,
            quantity: 0,
            confidence: 1,
            flags: [],
          },
        ],
      };
    });
    setAddItemOpen(false);
    setMedicineSearch("");
    if (step !== "review") setStep("review");
  }

  async function processBase64(base64: string, mimeType: string, source: "camera" | "pdf" | "email") {
    setSourceLabel(source);
    setStep("enhancing");
    const enhanced = await enhanceInvoiceImage(base64, mimeType);
    setStep("extracting");
    try {
      const result = await extractInvoice({
        data: { imageBase64: enhanced.base64, mimeType: enhanced.mimeType, sourceLabel: source },
      });
      setDraft(result.draft);
      setStep("review");
      toast.success(`Extracted ${result.draft.items.length} line item(s) from the invoice.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extract invoice.");
      setStep("capture");
    }
  }

  async function processFile(file: Blob, source: "camera" | "pdf" | "email") {
    const { base64, mimeType } = await fileToBase64(file);
    await processBase64(base64, mimeType, source);
  }

  async function processMaybePdf(file: File, source: "camera" | "pdf" | "email") {
    if (file.type !== "application/pdf") {
      await processFile(file, source);
      return;
    }
    setStep("converting");
    try {
      const imageBlob = await pdfToImageBlob(file);
      await processFile(imageBlob, source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read this PDF. Try exporting it as an image instead.");
      setStep("capture");
    }
  }

  function updateItem(index: number, patch: Partial<DraftItem>) {
    setDraft((d) => {
      if (!d) return d;
      const items = [...d.items];
      items[index] = { ...items[index], ...patch };
      return { ...d, items };
    });
  }

  function removeItem(index: number) {
    setDraft((d) => (d ? { ...d, items: d.items.filter((_, i) => i !== index) } : d));
  }

  async function handleSave() {
    if (!draft) return;
    setSaving(true);
    try {
      const result = await savePurchase({
        data: {
          supplier: draft.supplier,
          invoiceNumber: draft.invoiceNumber,
          serialNumber: draft.serialNumber,
          invoiceDate: draft.invoiceDate,
          billNumber: draft.billNumber,
          invoiceTotal: draft.invoiceTotal,
          netAmount: draft.netAmount,
          taxAmount: draft.taxAmount,
          sourceLabel,
          overallConfidence: draft.overallConfidence,
          items: draft.items,
        },
      });
      toast.success(`Purchase #${result.purchaseId} saved.`);
      navigate({ to: "/app/purchases" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save purchase.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-bold">Purchase Entry — AI Powered</h1>
        <p className="text-sm text-muted-foreground">
          Snap a photo of a supplier invoice and let AI fill in the details, or add items manually. Verify before
          saving.
        </p>
      </div>

      {step === "capture" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-6 p-10">
            <ScanLine className="h-12 w-12 text-primary" />
            <p className="text-center text-sm text-muted-foreground">
              Choose how you'd like to capture the invoice
            </p>
            <div className="grid w-full max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent">
                <Camera className="h-5 w-5" />
                Mobile Camera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], "camera")}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent">
                <ImagePlus className="h-5 w-5" />
                PDF Upload
                <input
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processMaybePdf(e.target.files[0], "pdf")}
                />
              </label>
              <button
                className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent"
                onClick={startManualEntry}
              >
                <SquarePen className="h-5 w-5" />
                Manual Entry
              </button>
              <button
                className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent"
                onClick={() => setShowEmailDialog(true)}
              >
                <Mail className="h-5 w-5" />
                Fetch from Email
              </button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === "converting" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Converting PDF to an image…</p>
          </CardContent>
        </Card>
      )}

      {step === "enhancing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Sharpening and correcting the photo…</p>
          </CardContent>
        </Card>
      )}

      {step === "extracting" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">AI is reading the invoice…</p>
          </CardContent>
        </Card>
      )}

      {step === "review" && draft && (
        <div className="flex flex-col gap-4">
          {draft.overallConfidence < 0.6 && (
            <Card className="border-amber-500/50 bg-amber-500/10">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="text-sm text-amber-700 dark:text-amber-400">
                  Overall confidence is only {Math.round(draft.overallConfidence * 100)}% — the photo may have been
                  blurry, dark, or at an angle. Carefully check every row below against the original invoice, or
                  retake the photo in better light for a cleaner read.
                </p>
                <Button variant="outline" size="sm" onClick={() => setStep("capture")}>
                  Retake Photo
                </Button>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Invoice Details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Field label="Supplier">
                <Input
                  value={draft.supplier.name}
                  onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, name: e.target.value } })}
                />
              </Field>
              <Field label="Supplier GST">
                <Input
                  value={draft.supplier.gstNumber}
                  onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, gstNumber: e.target.value } })}
                />
              </Field>
              <Field label="Supplier D.L. No">
                <Input
                  value={draft.supplier.dlNo}
                  onChange={(e) => setDraft({ ...draft, supplier: { ...draft.supplier, dlNo: e.target.value } })}
                />
              </Field>
              <Field label="Invoice Number">
                <Input value={draft.invoiceNumber} onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })} />
              </Field>
              <Field label="Serial Number">
                <Input value={draft.serialNumber} onChange={(e) => setDraft({ ...draft, serialNumber: e.target.value })} />
              </Field>
              <Field label="Invoice Date">
                <Input
                  type="date"
                  value={draft.invoiceDate}
                  onChange={(e) => setDraft({ ...draft, invoiceDate: e.target.value })}
                />
              </Field>
              <Field label="Bill Number">
                <Input value={draft.billNumber} onChange={(e) => setDraft({ ...draft, billNumber: e.target.value })} />
              </Field>
              <Field label="Invoice Total">
                <Input
                  type="number"
                  value={draft.invoiceTotal}
                  onChange={(e) => setDraft({ ...draft, invoiceTotal: Number(e.target.value) })}
                />
              </Field>
              <Field label="Tax Amount">
                <Input
                  type="number"
                  value={draft.taxAmount}
                  onChange={(e) => setDraft({ ...draft, taxAmount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Net Amount">
                <Input
                  type="number"
                  value={draft.netAmount}
                  onChange={(e) => setDraft({ ...draft, netAmount: Number(e.target.value) })}
                />
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-sm">
                Line Items ({draft.items.length}) · Overall confidence {Math.round(draft.overallConfidence * 100)}%
              </CardTitle>
              <Popover open={addItemOpen} onOpenChange={setAddItemOpen}>
                <PopoverTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus className="h-4 w-4" /> Add Item
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Type a medicine name…"
                      value={medicineSearch}
                      onValueChange={setMedicineSearch}
                    />
                    <CommandList>
                      <CommandEmpty>
                        {medicineSearch ? "No medicine matched." : "Start typing to search medicines…"}
                      </CommandEmpty>
                      <CommandGroup>
                        {medicineResults?.map((m) => (
                          <CommandItem key={m.id} value={String(m.id)} onSelect={() => addManualItem(m)}>
                            <div className="flex flex-1 items-center justify-between gap-2">
                              <div className="flex flex-col">
                                <span className="font-medium">{m.name}</span>
                                <span className="text-xs text-muted-foreground">
                                  {[m.pack, m.company].filter(Boolean).join(" · ") || "—"}
                                </span>
                              </div>
                              <SearchCheck className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Pack</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>HSN</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Free</TableHead>
                    <TableHead>Rate ₹</TableHead>
                    <TableHead>MRP ₹</TableHead>
                    <TableHead>GST %</TableHead>
                    <TableHead>GST Value ₹</TableHead>
                    <TableHead>Amount ₹</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {draft.items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={14} className="p-8 text-center text-muted-foreground">
                        No line items yet. Use "Add Item" to search for a medicine and add it manually.
                      </TableCell>
                    </TableRow>
                  )}
                  {draft.items.map((item, i) => (
                    <TableRow
                      key={i}
                      className={cn(item.confidence < 0.7 && "bg-amber-500/5")}
                    >
                      <TableCell className="min-w-40">
                        <Input
                          value={item.medicineNameRaw}
                          onChange={(e) => updateItem(i, { medicineNameRaw: e.target.value })}
                        />
                        {item.medicineId && <Badge variant="secondary" className="mt-1">existing medicine</Badge>}
                      </TableCell>
                      <TableCell>
                        <Input className="w-20" value={item.pack ?? ""} onChange={(e) => updateItem(i, { pack: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input className="w-24" value={item.batchNo ?? ""} onChange={(e) => updateItem(i, { batchNo: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-36"
                          type="date"
                          value={item.expiryDate ?? ""}
                          onChange={(e) => updateItem(i, { expiryDate: e.target.value })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input className="w-20" value={item.hsnCode ?? ""} onChange={(e) => updateItem(i, { hsnCode: e.target.value })} />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-16"
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-16"
                          type="number"
                          value={item.freeQty ?? 0}
                          onChange={(e) => updateItem(i, { freeQty: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-20"
                          type="number"
                          value={item.purchasePrice}
                          onChange={(e) => updateItem(i, { purchasePrice: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-20"
                          type="number"
                          value={item.mrp}
                          onChange={(e) => updateItem(i, { mrp: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          className="w-16"
                          type="number"
                          value={item.gstPercent}
                          onChange={(e) => updateItem(i, { gstPercent: Number(e.target.value) })}
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-xs text-muted-foreground">
                        {((item.purchasePrice * item.quantity * item.gstPercent) / 100).toFixed(2)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right font-mono text-xs">
                        {(item.purchasePrice * item.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell className="max-w-40">
                        <div className="flex flex-wrap gap-1">
                          {(item.flags ?? []).map((flag) => (
                            <Badge key={flag} variant="destructive" className="text-[10px]">
                              {FLAG_LABELS[flag] ?? flag}
                            </Badge>
                          ))}
                          {item.confidence < 0.7 && (
                            <Badge variant="outline" className="border-amber-500 text-[10px] text-amber-600">
                              Low confidence
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" onClick={() => removeItem(i)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setStep("capture")}>
              Discard
            </Button>
            <Button onClick={handleSave} disabled={saving || draft.items.length === 0}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Verify &amp; Save
            </Button>
          </div>
        </div>
      )}

      <FetchEmailDialog
        open={showEmailDialog}
        onOpenChange={setShowEmailDialog}
        onSelectImage={(base64, mimeType) => {
          setShowEmailDialog(false);
          processBase64(base64, mimeType, "email");
        }}
      />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
