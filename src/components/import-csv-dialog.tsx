import { useState } from "react";
import { toast } from "sonner";
import { Download, Loader2, Upload } from "lucide-react";
import { buildCsvTemplate, parseCsvToObjects, remapCsvRows, type CsvTemplateColumn } from "@/lib/csv";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export interface ImportResult {
  created: number;
  skipped: number;
  errors: string[];
}

interface ImportCsvDialogProps {
  /** Singular, human-readable entity name, e.g. "Medicine", "Supplier". */
  entityName: string;
  columns: CsvTemplateColumn[];
  onImport: (rows: Record<string, string>[]) => Promise<ImportResult>;
  onImported?: () => void;
}

// Generic CSV bulk-import dialog reused across Inventory, Suppliers, Doctors and Customers: parses
// the file entirely client-side (no size/row limit beyond the browser's own memory), matches
// columns to the caller's field list by label (case-insensitive, tolerant of the "*" required
// marker) rather than requiring an exact header match, and reports created/skipped/error counts
// per row after the server-side bulk-import call returns.
export function ImportCsvDialog({ entityName, columns, onImport, onImported }: ImportCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  function reset() {
    setFileName("");
    setRows(null);
    setResult(null);
  }

  function downloadTemplate() {
    const csv = buildCsvTemplate(columns);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${entityName.toLowerCase().replace(/\s+/g, "-")}-import-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = parseCsvToObjects(text);
    setFileName(file.name);
    setRows(remapCsvRows(parsed, columns));
    setResult(null);
  }

  async function handleImport() {
    if (!rows || rows.length === 0) return;
    setImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      if (res.created > 0) {
        toast.success(`Imported ${res.created} ${entityName.toLowerCase()}(s).`);
        onImported?.();
      }
      if (res.created === 0 && res.errors.length > 0) {
        toast.error("Nothing was imported — see the errors below.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const requiredKeys = columns.filter((c) => c.required).map((c) => c.key);
  const missingRequiredCount = rows?.filter((r) => requiredKeys.some((k) => !r[k]?.trim())).length ?? 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Upload className="h-4 w-4" /> Import CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import {entityName}s from CSV</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Download the template below, fill in one row per {entityName.toLowerCase()}, then upload it here. Column
          headers are matched by name (case doesn't matter), so extra or reordered columns are fine.
        </p>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5" /> Download CSV Template
        </Button>
        <Input
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        {rows && (
          <p className="text-sm text-muted-foreground">
            {fileName}: {rows.length} row(s) ready.
            {missingRequiredCount > 0 && (
              <span className="text-destructive"> {missingRequiredCount} row(s) are missing a required field.</span>
            )}
          </p>
        )}
        {result && (
          <div className="rounded-md border border-border p-3 text-sm">
            <p>
              Created <strong>{result.created}</strong> · Skipped <strong>{result.skipped}</strong>
            </p>
            {result.errors.length > 0 && (
              <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4 text-xs text-destructive">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        <DialogFooter>
          <Button onClick={handleImport} disabled={!rows || rows.length === 0 || importing}>
            {importing && <Loader2 className="h-4 w-4 animate-spin" />}
            Import {rows ? `${rows.length} row(s)` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
