import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { listSales, getSale } from "@/lib/api/sales.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { printBill } from "@/lib/print-bill";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const { data, isLoading } = useQuery({ queryKey: ["sales"], queryFn: () => listSales({ data: { limit: 100 } }) });
  const { data: detail } = useQuery({
    queryKey: ["sale-detail", selectedId],
    queryFn: () => getSale({ data: { id: selectedId! } }),
    enabled: selectedId != null,
  });
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">Billing</h1>
        <p className="text-sm text-muted-foreground">Bill history across retail, GST, wholesale, credit and estimates.</p>
      </div>

      <Card>
        <CardContent className="p-0">
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
                    No bills yet. Head to Sales / POS to create one.
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
