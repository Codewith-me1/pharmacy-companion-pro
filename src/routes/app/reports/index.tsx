import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Printer } from "lucide-react";
import {
  salesReport,
  purchaseReport,
  gstReport,
  profitLossReport,
  inventoryMovementReport,
  companyWiseReport,
  categoryWiseReport,
  purchaseItemFlagsReport,
} from "@/lib/api/reports.functions";
import { downloadCsv } from "@/lib/download-csv";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/reports/")({
  component: ReportsPage,
});

const FLAG_LABELS: Record<string, string> = {
  wrong_expiry: "Wrong expiry",
  duplicate_batch: "Duplicate batch",
  existing_batch: "Existing batch",
  price_change: "Price changed",
  gst_mismatch: "GST mismatch",
  quantity_mismatch: "Qty issue",
};

function ReportToolbar({ onDownload, disabled }: { onDownload: () => void; disabled?: boolean }) {
  return (
    <div className="flex justify-end gap-2 p-3 pb-0">
      <Button variant="outline" size="sm" onClick={onDownload} disabled={disabled}>
        <Download className="h-3.5 w-3.5" /> Download CSV
      </Button>
      <Button variant="outline" size="sm" onClick={() => window.print()}>
        <Printer className="h-3.5 w-3.5" /> Print
      </Button>
    </div>
  );
}

function ReportsPage() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Sales, purchase, GST, profit and inventory analytics.</p>
      </div>

      <Tabs defaultValue="sales">
        <TabsList className="flex-wrap">
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="purchase">Purchase</TabsTrigger>
          <TabsTrigger value="gst">GST</TabsTrigger>
          <TabsTrigger value="profit">Profit &amp; Loss</TabsTrigger>
          <TabsTrigger value="inventory">Fast / Dead Stock</TabsTrigger>
          <TabsTrigger value="company">Company Wise</TabsTrigger>
          <TabsTrigger value="category">Category Wise</TabsTrigger>
          <TabsTrigger value="flags">AI Flagged Items</TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesReportTab />
        </TabsContent>
        <TabsContent value="purchase">
          <PurchaseReportTab />
        </TabsContent>
        <TabsContent value="gst">
          <GstReportTab />
        </TabsContent>
        <TabsContent value="profit">
          <ProfitReportTab />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryMovementTab />
        </TabsContent>
        <TabsContent value="company">
          <CompanyWiseTab />
        </TabsContent>
        <TabsContent value="category">
          <CategoryWiseTab />
        </TabsContent>
        <TabsContent value="flags">
          <FlagsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const BILL_TYPES = ["retail", "gst", "wholesale", "estimate", "quotation", "credit"] as const;

function SalesReportTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [billType, setBillType] = useState<string>("all");
  const { data } = useQuery({
    queryKey: ["report-sales", from, to],
    queryFn: () => salesReport({ data: { from: from || undefined, to: to || undefined } }),
  });

  const filtered = useMemo(() => (data ?? []).filter((s) => billType === "all" || s.billType === billType), [data, billType]);

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 p-3 pb-0">
        <FilterField label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FilterField>
        <FilterField label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FilterField>
        <FilterField label="Bill Type">
          <Select value={billType} onValueChange={setBillType}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {BILL_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <div className="flex-1" />
      </div>
      <ReportToolbar disabled={filtered.length === 0} onDownload={() => downloadCsv("sales-report", filtered)} />
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Bill #</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Subtotal</TableHead>
              <TableHead className="text-right">GST</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="p-8 text-center text-muted-foreground">
                  No matching sales.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.billNumber}</TableCell>
                <TableCell className="capitalize">{s.billType}</TableCell>
                <TableCell>{formatDate(s.createdAt)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(s.subtotal)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(s.gstAmount)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(s.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PurchaseReportTab() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [supplier, setSupplier] = useState("");
  const { data } = useQuery({
    queryKey: ["report-purchase", from, to],
    queryFn: () => purchaseReport({ data: { from: from || undefined, to: to || undefined } }),
  });

  const filtered = useMemo(
    () => (data ?? []).filter((p) => !supplier || (p.supplierName ?? "").toLowerCase().includes(supplier.toLowerCase())),
    [data, supplier],
  );

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 p-3 pb-0">
        <FilterField label="From">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FilterField>
        <FilterField label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FilterField>
        <FilterField label="Supplier">
          <Input placeholder="Filter by supplier…" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
        </FilterField>
        <div className="flex-1" />
      </div>
      <ReportToolbar disabled={filtered.length === 0} onDownload={() => downloadCsv("purchase-report", filtered)} />
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice #</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="p-8 text-center text-muted-foreground">
                  No matching purchases.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell>{p.invoiceNumber || "—"}</TableCell>
                <TableCell>{p.supplierName || "—"}</TableCell>
                <TableCell>{formatDate(p.createdAt)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(p.taxAmount)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(p.invoiceTotal)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function GstReportTab() {
  const { data } = useQuery({ queryKey: ["report-gst"], queryFn: () => gstReport() });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <ReportToolbar disabled={!data?.outputGst.length} onDownload={() => downloadCsv("output-gst", data?.outputGst ?? [])} />
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Output GST (Sales)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">GST Collected</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.outputGst.map((row) => (
                <TableRow key={row.month}>
                  <TableCell>{row.month}</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(row.gstCollected)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <ReportToolbar disabled={!data?.inputGst.length} onDownload={() => downloadCsv("input-gst", data?.inputGst ?? [])} />
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Input GST (Purchases)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">GST Paid</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.inputGst.map((row) => (
                <TableRow key={row.month}>
                  <TableCell>{row.month}</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(row.gstPaid)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfitReportTab() {
  const { data } = useQuery({ queryKey: ["report-profit"], queryFn: () => profitLossReport() });
  return (
    <Card>
      <ReportToolbar disabled={!data?.length} onDownload={() => downloadCsv("profit-loss-report", data ?? [])} />
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data?.map((row) => (
              <TableRow key={row.month}>
                <TableCell>{row.month}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(row.revenue)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(row.cost)}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(row.profit)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function InventoryMovementTab() {
  const { data } = useQuery({ queryKey: ["report-inventory"], queryFn: () => inventoryMovementReport() });
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <ReportToolbar disabled={!data?.fastMoving.length} onDownload={() => downloadCsv("fast-moving", data?.fastMoving ?? [])} />
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Fast Moving (60 days)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.fastMoving.map((row) => (
                <TableRow key={row.medicineId}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">{row.totalQty}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <ReportToolbar disabled={!data?.deadStock.length} onDownload={() => downloadCsv("dead-stock", data?.deadStock ?? [])} />
        <CardContent className="p-4">
          <h3 className="mb-2 text-sm font-semibold">Dead Stock (no sale in 90 days)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Medicine</TableHead>
                <TableHead className="text-right">Stock</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.deadStock.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.name}</TableCell>
                  <TableCell className="text-right">{row.totalStock}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CompanyWiseTab() {
  const [search, setSearch] = useState("");
  const { data } = useQuery({ queryKey: ["report-company"], queryFn: () => companyWiseReport() });
  const filtered = useMemo(
    () => (data ?? []).filter((row) => !search || (row.company ?? "").toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );
  return (
    <Card>
      <div className="flex items-end gap-3 p-3 pb-0">
        <FilterField label="Company">
          <Input placeholder="Filter by company…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </FilterField>
        <div className="flex-1" />
      </div>
      <ReportToolbar disabled={filtered.length === 0} onDownload={() => downloadCsv("company-wise-report", filtered)} />
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead className="text-right">Medicines</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.company ?? "unknown"}>
                <TableCell>{row.company || "Unspecified"}</TableCell>
                <TableCell className="text-right">{row.medicineCount}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(row.totalStockValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function CategoryWiseTab() {
  const [search, setSearch] = useState("");
  const { data } = useQuery({ queryKey: ["report-category"], queryFn: () => categoryWiseReport() });
  const filtered = useMemo(
    () => (data ?? []).filter((row) => !search || (row.category ?? "").toLowerCase().includes(search.toLowerCase())),
    [data, search],
  );
  return (
    <Card>
      <div className="flex items-end gap-3 p-3 pb-0">
        <FilterField label="Category">
          <Input placeholder="Filter by category…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </FilterField>
        <div className="flex-1" />
      </div>
      <ReportToolbar disabled={filtered.length === 0} onDownload={() => downloadCsv("category-wise-report", filtered)} />
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Medicines</TableHead>
              <TableHead className="text-right">Stock Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((row) => (
              <TableRow key={row.category ?? "unknown"}>
                <TableCell>{row.category || "Unspecified"}</TableCell>
                <TableCell className="text-right">{row.medicineCount}</TableCell>
                <TableCell className="text-right font-mono">{formatInr(row.totalStockValue)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FlagsTab() {
  const [flagFilter, setFlagFilter] = useState("all");
  const { data } = useQuery({ queryKey: ["report-flags"], queryFn: () => purchaseItemFlagsReport() });
  const filtered = useMemo(
    () => (data ?? []).filter((row) => flagFilter === "all" || row.flags.includes(flagFilter)),
    [data, flagFilter],
  );

  return (
    <Card>
      <div className="flex items-end gap-3 p-3 pb-0">
        <FilterField label="Flag Type">
          <Select value={flagFilter} onValueChange={setFlagFilter}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All flags</SelectItem>
              {Object.entries(FLAG_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <div className="flex-1" />
      </div>
      <ReportToolbar
        disabled={filtered.length === 0}
        onDownload={() => downloadCsv("ai-flagged-items", filtered.map((r) => ({ ...r, flags: r.flags.join("; ") })))}
      />
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Medicine</TableHead>
              <TableHead>Flags</TableHead>
              <TableHead>Detected On</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="p-8 text-center text-muted-foreground">
                  No AI-flagged purchase items.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.medicineNameRaw}</TableCell>
                <TableCell className="flex flex-wrap gap-1">
                  {row.flags.map((f) => (
                    <Badge key={f} variant="destructive" className="text-[10px]">
                      {FLAG_LABELS[f] ?? f}
                    </Badge>
                  ))}
                </TableCell>
                <TableCell>{formatDate(row.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
