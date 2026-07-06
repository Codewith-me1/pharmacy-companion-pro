import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, ScanLine } from "lucide-react";
import { listPurchases } from "@/lib/api/purchases.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatInr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/purchases/")({
  component: PurchasesList,
});

function PurchasesList() {
  const { data, isLoading } = useQuery({ queryKey: ["purchases"], queryFn: () => listPurchases() });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Purchase Entry</h1>
          <p className="text-sm text-muted-foreground">AI-powered invoice capture and purchase history.</p>
        </div>
        <Button asChild>
          <Link to="/app/purchases/new">
            <ScanLine className="h-4 w-4" /> New Purchase
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Bill #</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>OCR Confidence</TableHead>
                <TableHead>Status</TableHead>
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
              {!isLoading && data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    No purchases yet. Click "New Purchase" to scan your first invoice.
                  </TableCell>
                </TableRow>
              )}
              {data?.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.invoiceNumber || "—"}</TableCell>
                  <TableCell>{p.supplierName || "—"}</TableCell>
                  <TableCell>{formatDate(p.invoiceDate)}</TableCell>
                  <TableCell>{p.billNumber || "—"}</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(p.invoiceTotal)}</TableCell>
                  <TableCell>{p.ocrConfidence != null ? `${Math.round(p.ocrConfidence * 100)}%` : "—"}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "verified" ? "default" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
