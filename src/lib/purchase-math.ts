// Shared by the purchase entry screen and savePurchase, so the credit-note deduction the user
// sees before saving is exactly the one the server records.

type PurchaseLine = {
  purchasePrice: number;
  quantity: number;
  discount?: number | null;
  gstPercent: number;
  cgst?: number | null;
  sgst?: number | null;
  igst?: number | null;
};

// Rounds to paise, half up. Scaling first through toPrecision strips float noise, so a value that
// is exactly half a paisa on paper (e.g. 2.90625 -> 290.625) rounds up the way billing software
// does instead of down because it was stored as 290.62499999.
export function roundPaise(n: number): number {
  return Math.round(Number((n * 100).toPrecision(12))) / 100;
}

// Every amount below is rounded to paise per line, then summed — the same way supplier billing
// software (e.g. C-Square/Marg) prints its invoice foot. Summing unrounded values and rounding
// once at the end drifts from the printed invoice by a few paise on almost every bill.

// A line's amount as shown in the table: rate x quantity, before any discount. Discount and GST
// are not applied per row — they are totalled once at the foot of the bill (purchaseBillSummary).
export function grossLineAmount(item: { purchasePrice: number; quantity: number }): number {
  return roundPaise(item.purchasePrice * item.quantity);
}

export function lineDiscountAmount(item: {
  purchasePrice: number;
  quantity: number;
  discount?: number | null;
}): number {
  return roundPaise((grossLineAmount(item) * (item.discount ?? 0)) / 100);
}

// Trade discount is applied before GST, matching how suppliers compute it on the printed invoice:
// GST is charged on the discounted (taxable) value, not on rate x quantity.
export function netLineAmount(item: {
  purchasePrice: number;
  quantity: number;
  discount?: number | null;
}): number {
  return roundPaise(grossLineAmount(item) - lineDiscountAmount(item));
}

// GST on one line. Intra-state invoices charge CGST and SGST at half the rate each, and each half
// is rounded on its own (2.906 + 2.906 prints as 2.91 + 2.91 = 5.82, not 5.81) — that is where a
// typical 2-paise gap against the printed "GST Tax Amt" comes from. A line read as IGST-only
// (inter-state) is one tax at the full rate, rounded once.
export function lineGstAmount(item: PurchaseLine): number {
  const taxable = netLineAmount(item);
  const interState = (item.igst ?? 0) > 0 && !(item.cgst ?? 0) && !(item.sgst ?? 0);
  if (interState) return roundPaise((taxable * item.gstPercent) / 100);
  return 2 * roundPaise((taxable * item.gstPercent) / 200);
}

// The bill foot: gross of all lines, less all line discounts, GST on the taxable value added, and
// the total rounded to the whole rupee as the payable amount, with the difference as round off.
export function purchaseBillSummary(items: PurchaseLine[]) {
  const gross = roundPaise(items.reduce((sum, item) => sum + grossLineAmount(item), 0));
  const discount = roundPaise(items.reduce((sum, item) => sum + lineDiscountAmount(item), 0));
  const taxable = roundPaise(items.reduce((sum, item) => sum + netLineAmount(item), 0));
  const gst = roundPaise(items.reduce((sum, item) => sum + lineGstAmount(item), 0));
  const total = roundPaise(taxable + gst);
  const netPayable = Math.round(total);
  return { gross, discount, taxable, gst, total, roundOff: roundPaise(netPayable - total), netPayable };
}

// The bill amount a credit note can be deducted from: the supplier's printed grand total when it
// was entered, otherwise the payable amount calculated from the line items (manual entries often
// leave the invoice total blank).
export function purchaseBillTotal(purchase: {
  invoiceTotal?: number | null;
  items: PurchaseLine[];
}): number {
  if (purchase.invoiceTotal && purchase.invoiceTotal > 0) return purchase.invoiceTotal;
  return purchaseBillSummary(purchase.items).netPayable;
}

// Applies credit notes in the given order until the bill is covered. A note larger than what is
// left takes only that much, and keeps its remainder for the supplier's next bill.
export function allocateCreditNotes<T extends { id: number; remaining: number }>(
  billTotal: number,
  notes: T[],
): { note: T; amount: number }[] {
  let left = Math.max(0, billTotal);
  const allocations: { note: T; amount: number }[] = [];
  for (const note of notes) {
    if (left <= 0.005) break;
    const amount = Math.round(Math.min(note.remaining, left) * 100) / 100;
    if (amount <= 0) continue;
    allocations.push({ note, amount });
    left -= amount;
  }
  return allocations;
}
