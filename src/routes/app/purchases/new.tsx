import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, ScanLine, Trash2, Video } from "lucide-react";
import { extractInvoice, savePurchase } from "@/lib/api/purchases.functions";
import { fileToBase64 } from "@/lib/file-to-base64";
import { WebcamCapture } from "@/components/webcam-capture";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
};

function NewPurchase() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"capture" | "extracting" | "review">("capture");
  const [showWebcam, setShowWebcam] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [sourceLabel, setSourceLabel] = useState<"camera" | "webcam" | "pdf" | "scanner">("camera");
  const [saving, setSaving] = useState(false);

  async function processFile(file: Blob, source: typeof sourceLabel) {
    setStep("extracting");
    setSourceLabel(source);
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const result = await extractInvoice({ data: { imageBase64: base64, mimeType, sourceLabel: source } });
      setDraft(result.draft);
      setStep("review");
      toast.success(`Extracted ${result.draft.items.length} line item(s) from the invoice.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extract invoice.");
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
          Snap a photo of a supplier invoice and let AI fill in the details. Verify before saving.
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
              <button
                className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent"
                onClick={() => setShowWebcam(true)}
              >
                <Video className="h-5 w-5" />
                Webcam
              </button>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent">
                <ImagePlus className="h-5 w-5" />
                PDF Upload
                <input
                  type="file"
                  accept="image/*,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.type === "application/pdf") {
                      toast.error("PDF pages must be exported as an image (JPG/PNG) for AI extraction.");
                      return;
                    }
                    processFile(file, "pdf");
                  }}
                />
              </label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-border p-4 text-sm hover:bg-accent">
                <ScanLine className="h-5 w-5" />
                Scanner Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], "scanner")}
                />
              </label>
            </div>
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
              <Field label="Invoice Number">
                <Input value={draft.invoiceNumber} onChange={(e) => setDraft({ ...draft, invoiceNumber: e.target.value })} />
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
            <CardHeader>
              <CardTitle className="text-sm">
                Line Items ({draft.items.length}) · Overall confidence {Math.round(draft.overallConfidence * 100)}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Free</TableHead>
                    <TableHead>Purchase ₹</TableHead>
                    <TableHead>MRP ₹</TableHead>
                    <TableHead>GST %</TableHead>
                    <TableHead>Flags</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
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

      {showWebcam && (
        <WebcamCapture
          onClose={() => setShowWebcam(false)}
          onCapture={(blob) => {
            setShowWebcam(false);
            processFile(blob, "webcam");
          }}
        />
      )}
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
