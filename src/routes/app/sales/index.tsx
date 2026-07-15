import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Barcode, Dices, Plus, Printer, Search, ShoppingCart, Trash2 } from "lucide-react";
import { listMedicines, searchMedicineBatches } from "@/lib/api/medicines.functions";
import { listBatchesForMedicine } from "@/lib/api/stock.functions";
import { listDoctors, getDoctorWithMedicines } from "@/lib/api/doctors.functions";
import { listCustomers, upsertCustomer } from "@/lib/api/customers.functions";
import { createSale } from "@/lib/api/sales.functions";
import { getBusinessSettings } from "@/lib/api/business-settings.functions";
import { getBillSettings } from "@/lib/api/bill-settings.functions";
import { printBill, type PrintBillData } from "@/lib/print-bill";
import { generateRandomCustomerName } from "@/lib/random-name";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatInr, formatDate } from "@/lib/format";

type BatchOption = Awaited<ReturnType<typeof listBatchesForMedicine>>[number];
type CartableBatch = {
  id: number;
  batchNo: string;
  expiryDate: string;
  quantity: number;
  mrp: number;
  supplierName: string | null;
  discount?: number;
  gstPercent?: number;
};

export const Route = createFileRoute("/app/sales/")({
  component: SalesPos,
});

type CartLine = {
  key: string;
  medicineId: number;
  medicineName: string;
  pack: string | null;
  batchId: number;
  batchNo: string;
  expiryDate: string;
  supplierName: string | null;
  availableQty: number;
  mrp: number;
  salePrice: number;
  gstPercent: number;
  quantity: number;
};

function SalesPos() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const [barcode, setBarcode] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [doctorId, setDoctorId] = useState<number | null>(null);
  const [billType, setBillType] = useState<"retail" | "gst" | "wholesale" | "estimate" | "quotation" | "credit">("retail");
  const [paymentMode, setPaymentMode] = useState<"cash" | "upi" | "card" | "credit" | "split">("cash");
  const [discount, setDiscount] = useState(0);
  const [lastBill, setLastBill] = useState<PrintBillData | null>(null);
  const [batchPicker, setBatchPicker] = useState<{
    medicineId: number;
    medicineName: string;
    pack: string | null;
    defaultQty: number;
    batches: BatchOption[];
  } | null>(null);
  const [showNewCustomer, setShowNewCustomer] = useState(true);
  const [newCustomerName, setNewCustomerName] = useState(() => generateRandomCustomerName());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setSearchOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const { data: searchResults } = useQuery({
    queryKey: ["medicine-batch-search", search],
    queryFn: () => searchMedicineBatches({ data: { search } }),
    enabled: search.length > 0,
  });
  const { data: doctors } = useQuery({ queryKey: ["doctors"], queryFn: () => listDoctors() });
  const { data: customers } = useQuery({ queryKey: ["customers"], queryFn: () => listCustomers() });
  const { data: business } = useQuery({ queryKey: ["business-settings"], queryFn: () => getBusinessSettings() });
  const { data: billSettings } = useQuery({ queryKey: ["bill-settings"], queryFn: () => getBillSettings() });
  const { data: doctorDetail } = useQuery({
    queryKey: ["doctor-detail", doctorId],
    queryFn: () => getDoctorWithMedicines({ data: { id: doctorId! } }),
    enabled: doctorId != null,
  });

  function addBatchToCart(
    medicineId: number,
    medicineName: string,
    pack: string | null,
    batch: CartableBatch,
    defaultQty: number,
  ) {
    setCart((c) => {
      const existing = c.find((l) => l.batchId === batch.id);
      if (existing) {
        return c.map((l) => (l.batchId === batch.id ? { ...l, quantity: l.quantity + defaultQty } : l));
      }
      const discountPercent = batch.discount ?? 0;
      const salePrice = discountPercent > 0 ? Number((batch.mrp * (1 - discountPercent / 100)).toFixed(2)) : batch.mrp;
      return [
        ...c,
        {
          key: `${medicineId}-${batch.id}`,
          medicineId,
          medicineName,
          pack,
          batchId: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          supplierName: batch.supplierName,
          availableQty: batch.quantity,
          mrp: batch.mrp,
          salePrice,
          gstPercent: batch.gstPercent ?? 12,
          quantity: defaultQty,
        },
      ];
    });
  }

  async function selectMedicine(medicineId: number, medicineName: string, pack: string | null, defaultQty = 1) {
    const batches = await queryClient.fetchQuery({
      queryKey: ["batches", medicineId],
      queryFn: () => listBatchesForMedicine({ data: { medicineId } }),
    });
    const available = batches.filter((b) => b.quantity > 0).sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
    setSearch("");
    setSearchOpen(false);
    if (available.length === 0) {
      toast.error(`${medicineName} has no available stock.`);
      return;
    }
    if (available.length === 1) {
      addBatchToCart(medicineId, medicineName, pack, available[0], defaultQty);
      return;
    }
    setBatchPicker({ medicineId, medicineName, pack, defaultQty, batches: available });
  }

  const createCustomerMutation = useMutation({
    mutationFn: () => upsertCustomer({ data: { name: newCustomerName.trim() } }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["customers"] });
      setCustomerId(result.id);
      setNewCustomerName("");
      setShowNewCustomer(false);
      toast.success("Customer added.");
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to add customer."),
  });

  function updateLine(key: string, patch: Partial<CartLine>) {
    setCart((c) => c.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function removeLine(key: string) {
    setCart((c) => c.filter((l) => l.key !== key));
  }

  const subtotal = cart.reduce((s, l) => s + l.salePrice * l.quantity, 0);
  const gstAmount = cart.reduce((s, l) => s + (l.salePrice * l.quantity * l.gstPercent) / 100, 0);
  const total = subtotal + gstAmount - discount;

  const saleMutation = useMutation({
    mutationFn: () =>
      createSale({
        data: {
          customerId,
          doctorId,
          billType,
          paymentMode,
          discount,
          items: cart.map((l) => ({
            medicineId: l.medicineId,
            batchId: l.batchId,
            quantity: l.quantity,
            mrp: l.mrp,
            salePrice: l.salePrice,
            gstPercent: l.gstPercent,
            discount: 0,
          })),
        },
      }),
    onSuccess: (result) => {
      toast.success(`Bill ${result.billNumber} created.`);
      setLastBill({
        billNumber: result.billNumber,
        billType,
        createdAt: new Date().toLocaleDateString("en-IN"),
        firmName: business?.firmName,
        dlNo: business?.dlNo,
        gstNumber: business?.gstNumber,
        phone: business?.mobile,
        address: business?.address,
        customerName: customers?.find((c) => c.id === customerId)?.name ?? null,
        customerAddress: customers?.find((c) => c.id === customerId)?.address ?? null,
        doctorName: doctors?.find((d) => d.id === doctorId)?.name ?? null,
        items: cart.map((l) => ({
          medicineName: l.medicineName,
          pack: l.pack,
          batchNo: l.batchNo,
          expiryDate: l.expiryDate,
          quantity: l.quantity,
          rate: l.salePrice,
          mrp: l.mrp,
        })),
        discount,
        settings: billSettings,
      });
      setCart([]);
      setDiscount(0);
      setCustomerId(null);
      setShowNewCustomer(true);
      setNewCustomerName(generateRandomCustomerName());
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Failed to create sale."),
  });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="flex flex-col gap-4 xl:col-span-2">
        <div>
          <h1 className="text-xl font-bold">Sales / POS</h1>
          <p className="text-sm text-muted-foreground">Fast billing with batch-level stock awareness.</p>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1" ref={searchBoxRef}>
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search medicine or batch number…"
              value={search}
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearch(e.target.value);
                setSearchOpen(true);
              }}
            />
            {searchOpen && searchResults && searchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
                {searchResults.map((b) => {
                  const daysToExpiry = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000);
                  return (
                    <button
                      key={b.batchId}
                      className="flex w-full items-center justify-between gap-3 border-b border-border/50 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-accent"
                      onClick={() => {
                        addBatchToCart(
                          b.medicineId,
                          b.medicineName,
                          b.pack,
                          {
                            id: b.batchId,
                            batchNo: b.batchNo,
                            expiryDate: b.expiryDate,
                            quantity: b.quantity,
                            mrp: b.mrp,
                            supplierName: b.supplierName,
                            discount: b.discount,
                            gstPercent: b.gstPercent,
                          },
                          1,
                        );
                        setSearch("");
                        setSearchOpen(false);
                      }}
                    >
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {b.medicineName}
                          {b.pack ? ` (${b.pack})` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Batch {b.batchNo} · {b.supplierName || "—"} · {formatInr(b.mrp)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {daysToExpiry <= 90 && (
                          <Badge variant={daysToExpiry <= 30 ? "destructive" : "secondary"} className="text-[10px]">
                            {daysToExpiry <= 0 ? "expired" : `${daysToExpiry}d left`}
                          </Badge>
                        )}
                        <span className="rounded-md bg-green-500/15 px-2 py-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                          {b.quantity} in stock
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div className="relative w-48">
            <Barcode className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Scan barcode…"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key !== "Enter" || !barcode) return;
                const matches = await listMedicines({ data: { search: barcode } });
                if (matches.length === 1) {
                  selectMedicine(matches[0].id, matches[0].name, matches[0].pack);
                } else if (matches.length === 0) {
                  toast.error("No medicine matched that barcode.");
                } else {
                  toast.error("Multiple matches — search by name instead.");
                }
                setBarcode("");
              }}
            />
          </div>
        </div>

        {doctorId && doctorDetail && doctorDetail.favorites.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border p-3">
            <span className="text-xs font-medium text-muted-foreground">Dr. {doctorDetail.doctor.name} usually prescribes:</span>
            {doctorDetail.favorites.map((f) => (
              <Button
                key={f.id}
                variant="outline"
                size="sm"
                onClick={() => selectMedicine(f.medicineId, f.medicineName, f.pack, f.defaultQty)}
              >
                <Plus className="h-3 w-3" /> {f.medicineName}
              </Button>
            ))}
          </div>
        )}

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Medicine</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">GST%</TableHead>
                  <TableHead className="text-right">Line Total</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {cart.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="p-10 text-center text-muted-foreground">
                      <ShoppingCart className="mx-auto mb-2 h-6 w-6" />
                      Cart is empty. Search a medicine to begin billing.
                    </TableCell>
                  </TableRow>
                )}
                {cart.map((l) => (
                  <TableRow key={l.key}>
                    <TableCell className="font-medium">{l.medicineName}</TableCell>
                    <TableCell>{l.batchNo}</TableCell>
                    <TableCell className="text-muted-foreground">{l.supplierName || "—"}</TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-20 text-right"
                        value={l.salePrice}
                        onChange={(e) => updateLine(l.key, { salePrice: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-16 text-right"
                        value={l.quantity}
                        max={l.availableQty}
                        onChange={(e) => updateLine(l.key, { quantity: Math.min(Number(e.target.value), l.availableQty) })}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Input
                        type="number"
                        className="w-16 text-right"
                        value={l.gstPercent}
                        onChange={(e) => updateLine(l.key, { gstPercent: Number(e.target.value) })}
                      />
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatInr(l.salePrice * l.quantity)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => removeLine(l.key)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Bill Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Doctor (optional)</Label>
              <Select value={doctorId?.toString() ?? "none"} onValueChange={(v) => setDoctorId(v === "none" ? null : Number(v))}>
                <SelectTrigger>
                  <SelectValue placeholder="No doctor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No doctor</SelectItem>
                  {doctors?.map((d) => (
                    <SelectItem key={d.id} value={d.id.toString()}>
                      Dr. {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Customer</Label>
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() =>
                    setShowNewCustomer((v) => {
                      const next = !v;
                      if (next && !newCustomerName.trim()) setNewCustomerName(generateRandomCustomerName());
                      return next;
                    })
                  }
                >
                  {showNewCustomer ? "Cancel" : "+ New"}
                </button>
              </div>
              {showNewCustomer ? (
                <div className="flex gap-2">
                  <Input
                    placeholder="Customer name"
                    value={newCustomerName}
                    onChange={(e) => setNewCustomerName(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title="Generate a random name"
                    onClick={() => setNewCustomerName(generateRandomCustomerName())}
                  >
                    <Dices className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    disabled={!newCustomerName.trim() || createCustomerMutation.isPending}
                    onClick={() => createCustomerMutation.mutate()}
                  >
                    Add
                  </Button>
                </div>
              ) : (
                <Select value={customerId?.toString() ?? "none"} onValueChange={(v) => setCustomerId(v === "none" ? null : Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Walk-in customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Walk-in customer</SelectItem>
                    {customers?.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Bill Type</Label>
              <Select value={billType} onValueChange={(v) => setBillType(v as typeof billType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retail">Retail Bill</SelectItem>
                  <SelectItem value="gst">GST Bill</SelectItem>
                  <SelectItem value="wholesale">Wholesale Bill</SelectItem>
                  <SelectItem value="estimate">Estimate</SelectItem>
                  <SelectItem value="quotation">Quotation</SelectItem>
                  <SelectItem value="credit">Credit Bill</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Payment Mode</Label>
              <Select value={paymentMode} onValueChange={(v) => setPaymentMode(v as typeof paymentMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="split">Split Payment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Discount (₹)</Label>
              <Input type="number" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-2 p-4 text-sm">
            <Row label="Subtotal" value={formatInr(subtotal)} />
            <Row label="GST" value={formatInr(gstAmount)} />
            <Row label="Discount" value={`- ${formatInr(discount)}`} />
            <div className="border-t border-border pt-2">
              <Row label="Total" value={formatInr(total)} bold />
            </div>
            <Button
              size="lg"
              className="mt-2"
              disabled={cart.length === 0 || saleMutation.isPending}
              onClick={() => saleMutation.mutate()}
            >
              Complete Sale &amp; Print
            </Button>
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!lastBill} onOpenChange={(open) => !open && setLastBill(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bill {lastBill?.billNumber} Created</DialogTitle>
          </DialogHeader>
          {lastBill && (
            <div className="flex flex-col gap-2 text-sm">
              {lastBill.customerName && <p className="text-muted-foreground">Customer: {lastBill.customerName}</p>}
              {lastBill.doctorName && <p className="text-muted-foreground">Doctor: Dr. {lastBill.doctorName}</p>}
              <ul className="max-h-40 overflow-y-auto rounded-md border border-border p-2 text-xs">
                {lastBill.items.map((item, i) => (
                  <li key={i} className="flex justify-between py-0.5">
                    <span>
                      {item.medicineName} × {item.quantity}
                    </span>
                    <span className="font-mono">{formatInr(item.rate * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-base font-bold">
                Total:{" "}
                {formatInr(
                  Math.round(lastBill.items.reduce((s, i) => s + i.rate * i.quantity, 0) - lastBill.discount),
                )}
              </p>
              <Button onClick={() => printBill(lastBill)}>
                <Printer className="h-4 w-4" /> Print Bill
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!batchPicker} onOpenChange={(open) => !open && setBatchPicker(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Select Batch — {batchPicker?.medicineName}</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Multiple batches available across suppliers. Soonest-to-expire is listed first.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Batch No.</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batchPicker?.batches.map((b, i) => {
                const daysToExpiry = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / 86_400_000);
                return (
                  <TableRow key={b.id} className={i === 0 ? "bg-amber-500/5" : undefined}>
                    <TableCell className="font-medium">{b.batchNo}</TableCell>
                    <TableCell>{b.supplierName || "—"}</TableCell>
                    <TableCell>
                      {formatDate(b.expiryDate)}{" "}
                      {daysToExpiry <= 90 && (
                        <Badge variant={daysToExpiry <= 30 ? "destructive" : "secondary"} className="ml-1 text-[10px]">
                          {daysToExpiry <= 0 ? "expired" : `${daysToExpiry}d left`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="inline-block rounded-md bg-green-500/15 px-2 py-0.5 font-mono font-semibold text-green-700 dark:text-green-400">
                        {b.quantity}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{formatInr(b.mrp)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => {
                          if (!batchPicker) return;
                          addBatchToCart(batchPicker.medicineId, batchPicker.medicineName, batchPicker.pack, b, batchPicker.defaultQty);
                          setBatchPicker(null);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" /> Add
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold" : "text-muted-foreground"}`}>
      <span>{label}</span>
      <span className="font-mono text-foreground">{value}</span>
    </div>
  );
}
