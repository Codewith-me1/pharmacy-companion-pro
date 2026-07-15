import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CreditCard, Eye, IndianRupee, Printer, Receipt, Search, Smartphone, Wallet } from "lucide-react";
import { listSales, getSale, getBillingStats } from "@/lib/api/sales.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { getBillSettings } from "@/lib/api/bill-settings.functions";
import { printBill } from "@/lib/print-bill";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInr, formatDateTime, toDateInputValue } from "@/lib/format";

export const Route = createFileRoute("/app/billing/")({
  component: BillingPage,
});

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive"> = {
  paid: "default",
  pending: "destructive",
  partial: "secondary",
};

const DATE_PRESETS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7", label: "Last 7 Days" },
  { key: "last30", label: "Last 30 Days" },
  { key: "custom", label: "Custom" },
] as const;
type DatePreset = (typeof DATE_PRESETS)[number]["key"];

const PAYMENT_CHIPS = [
  { key: "all", label: "All" },
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
  { key: "credit", label: "Credit" },
  { key: "other", label: "Other" },
] as const;
type PaymentFilter = (typeof PAYMENT_CHIPS)[number]["key"];

function BillingPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>("all");

  const { dateFrom, dateTo } = useMemo(() => {
    const today = new Date();
    const todayStr = toDateInputValue(today);
    switch (datePreset) {
      case "yesterday": {
        const y = new Date(today);
        y.setDate(y.getDate() - 1);
        const yStr = toDateInputValue(y);
        return { dateFrom: yStr, dateTo: yStr };
      }
      case "last7": {
        const from = new Date(today);
        from.setDate(from.getDate() - 6);
        return { dateFrom: toDateInputValue(from), dateTo: todayStr };
      }
      case "last30": {
        const from = new Date(today);
        from.setDate(from.getDate() - 29);
        return { dateFrom: toDateInputValue(from), dateTo: todayStr };
      }
      case "custom":
        return { dateFrom: customFrom || undefined, dateTo: customTo || undefined };
      case "today":
      default:
        return { dateFrom: todayStr, dateTo: todayStr };
    }
  }, [datePreset, customFrom, customTo]);

  const { data, isLoading } = useQuery({
    queryKey: ["sales", search, dateFrom, dateTo, paymentFilter],
    queryFn: () =>
      listSales({
        data: {
          limit: 200,
          search: search || undefined,
          dateFrom,
          dateTo,
          paymentMode: paymentFilter === "all" ? undefined : paymentFilter,
        },
      }),
  });
  const { data: stats } = useQuery({
    queryKey: ["billing-stats", dateFrom, dateTo],
    queryFn: () => getBillingStats({ data: { dateFrom, dateTo } }),
  });
  const { data: detail } = useQuery({
    queryKey: ["sale-detail", selectedId],
    queryFn: () => getSale({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });
  const { data: billSettings } = useQuery({ queryKey: ["bill-settings"], queryFn: () => getBillSettings() });

  const printMutation = useMutation({
    mutationFn: (id: number) =>
      queryClient.fetchQuery({ queryKey: ["sale-detail", id], queryFn: () => getSale({ data: { id } }) }),
    onSuccess: (result) => {
      if (!result.sale) return;
      printBill({
        billNumber: result.sale.billNumber,
        billType: result.sale.billType,
        createdAt: formatDateTime(result.sale.createdAt),
        firmName: business?.firmName,
        dlNo: business?.dlNo,
        gstNumber: business?.gstNumber,
        phone: business?.mobile,
        address: business?.address,
        customerName: result.sale.customerName,
        customerAddress: result.sale.customerAddress,
        doctorName: result.sale.doctorName,
        items: result.items.map((i) => ({
          medicineName: i.medicineName,
          pack: i.pack,
          batchNo: i.batchNo,
          expiryDate: i.expiryDate,
          quantity: i.quantity,
          rate: i.salePrice,
          mrp: i.mrp,
        })),
        discount: result.sale.discount,
        settings: billSettings,
      });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to print bill."),
  });

  const avgSale = stats && stats.invoiceCount > 0 ? stats.totalSales / stats.invoiceCount : 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <h1 className="text-xl font-bold">Sales Invoices</h1>
        <Badge variant="secondary">{data?.length ?? 0} records</Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        {DATE_PRESETS.map((p) => (
          <Button
            key={p.key}
            size="sm"
            variant={datePreset === p.key ? "default" : "outline"}
            onClick={() => setDatePreset(p.key)}
          >
            {p.label}
          </Button>
        ))}
        {datePreset === "custom" && (
          <div className="flex items-center gap-2">
            <Input type="date" className="w-40" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="date" className="w-40" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total Sales" value={formatInr(stats?.totalSales)} icon={IndianRupee} />
        <StatCard label="Invoice Count" value={String(stats?.invoiceCount ?? 0)} sub={`Avg ${formatInr(avgSale)}`} icon={Receipt} />
        <StatCard label="Cash Sales" value={formatInr(stats?.cashSales)} sub={`${stats?.cashCount ?? 0} bills`} icon={Wallet} />
        <StatCard label="UPI Sales" value={formatInr(stats?.upiSales)} sub={`${stats?.upiCount ?? 0} bills`} icon={Smartphone} />
        <StatCard label="Card Sales" value={formatInr(stats?.cardSales)} sub={`${stats?.cardCount ?? 0} bills`} icon={CreditCard} />
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Invoice no / customer / phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {PAYMENT_CHIPS.map((chip) => (
              <Button
                key={chip.key}
                size="sm"
                variant={paymentFilter === chip.key ? "default" : "outline"}
                onClick={() => setPaymentFilter(chip.key)}
              >
                {chip.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Invoice No</TableHead>
                <TableHead>Date &amp; Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">GST</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && data?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="p-8 text-center text-muted-foreground">
                    No bills match these filters.
                  </TableCell>
                </TableRow>
              )}
              {data?.map((s, i) => (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelectedId(s.id)}>
                  <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                  <TableCell className="font-medium text-primary">{s.billNumber}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm">{formatDateTime(s.createdAt)}</TableCell>
                  <TableCell>
                    {s.customerName ? (
                      <>
                        <div>{s.customerName}</div>
                        {s.customerPhone && <div className="text-xs text-muted-foreground">{s.customerPhone}</div>}
                      </>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="uppercase">
                      {s.paymentMode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {s.discount > 0 ? `- ${formatInr(s.discount)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">{formatInr(s.gstAmount)}</TableCell>
                  <TableCell className="text-right font-mono font-medium">{formatInr(s.total)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[s.paymentStatus] ?? "secondary"} className="capitalize">
                      {s.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(s.id);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={printMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          printMutation.mutate(s.id);
                        }}
                      >
                        <Printer className="h-4 w-4" />
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
              <Button disabled={printMutation.isPending} onClick={() => selectedId && printMutation.mutate(selectedId)}>
                <Printer className="h-4 w-4" /> Print
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
