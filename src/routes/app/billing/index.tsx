import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer, Search } from "lucide-react";
import { listSales, listSaleYears, getSale } from "@/lib/api/sales.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { getBillSettings } from "@/lib/api/bill-settings.functions";
import { printBill } from "@/lib/print-bill";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInr, formatDate } from "@/lib/format";

export const Route = createFileRoute("/app/billing/")({
  component: BillingPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  pending: "destructive",
  partial: "secondary",
};

function BillingPage() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [year, setYear] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["sales", search, year, dateFrom, dateTo],
    queryFn: () =>
      listSales({
        data: {
          limit: 200,
          search: search || undefined,
          year: year !== "all" ? Number(year) : undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
        },
      }),
  });
  const { data: years } = useQuery({ queryKey: ["sale-years"], queryFn: () => listSaleYears() });
  const { data: detail } = useQuery({
    queryKey: ["sale-detail", selectedId],
    queryFn: () => getSale({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });
  const { data: billSettings } = useQuery({ queryKey: ["bill-settings"], queryFn: () => getBillSettings() });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground">Bill history across retail, GST, wholesale, credit and estimates.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:flex-wrap">
          <div className="flex min-w-50 flex-1 flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Bill number or customer name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">Year</Label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {years?.map((y) => (
                  <SelectItem key={y} value={y.toString()}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">From</Label>
            <Input type="date" className="w-40" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs text-muted-foreground">To</Label>
            <Input type="date" className="w-40" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          {(search || year !== "all" || dateFrom || dateTo) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setYear("all");
                setDateFrom("");
                setDateTo("");
              }}
            >
              Clear filters
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill #</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Total</TableHead>
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
              {data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="p-8 text-center text-muted-foreground">
                    No bills match these filters.
                  </TableCell>
                </TableRow>
              )}
              {data?.map((s) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                  <TableCell className="font-medium">{s.billNumber}</TableCell>
                  <TableCell className="capitalize">{s.billType}</TableCell>
                  <TableCell>{s.customerName || "Walk-in"}</TableCell>
                  <TableCell>{formatDate(s.createdAt)}</TableCell>
                  <TableCell className="uppercase">{s.paymentMode}</TableCell>
                  <TableCell className="text-right font-mono">{formatInr(s.total)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.paymentStatus] ?? "secondary"}>{s.paymentStatus}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={selectedId != null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Bill {detail?.sale?.billNumber}</DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="flex flex-col gap-3">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Medicine</TableHead>
                    <TableHead>Batch</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.items.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.medicineName}</TableCell>
                      <TableCell>{i.batchNo}</TableCell>
                      <TableCell className="text-right">{i.quantity}</TableCell>
                      <TableCell className="text-right font-mono">{formatInr(i.salePrice)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>Total</span>
                <span className="font-mono">{formatInr(detail.sale?.total)}</span>
              </div>
              <Button
                onClick={() =>
                  detail.sale &&
                  printBill({
                    billNumber: detail.sale.billNumber,
                    billType: detail.sale.billType,
                    createdAt: formatDate(detail.sale.createdAt),
                    firmName: business?.firmName,
                    dlNo: business?.dlNo,
                    gstNumber: business?.gstNumber,
                    phone: business?.mobile,
                    address: business?.address,
                    customerName: detail.sale.customerName,
                    customerAddress: detail.sale.customerAddress,
                    doctorName: detail.sale.doctorName,
                    items: detail.items.map((i) => ({
                      medicineName: i.medicineName,
                      pack: i.pack,
                      batchNo: i.batchNo,
                      expiryDate: i.expiryDate,
                      quantity: i.quantity,
                      rate: i.salePrice,
                      mrp: i.mrp,
                    })),
                    discount: detail.sale.discount,
                    settings: billSettings,
                  })
                }
              >
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
