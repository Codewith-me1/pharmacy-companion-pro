// Shared by the purchase entry screen and savePurchase, so the credit-note deduction the user
// sees before saving is exactly the one the server records.

type PurchaseLine = {
  purchasePrice: number;
  quantity: number;
  discount?: number | null;
  gstPercent: number;
};

// A line's amount as shown in the table: rate x quantity, before any discount. Discount and GST
// are not applied per row — they are totalled once at the foot of the bill (purchaseBillSummary).
export function grossLineAmount(item: { purchasePrice: number; quantity: number }): number {
  return item.purchasePrice * item.quantity;
}

// Trade discount is applied before GST, matching how suppliers compute it on the printed invoice:
// GST is charged on the discounted (taxable) value, not on rate x quantity.
export function netLineAmount(item: {
  purchasePrice: number;
  quantity: number;
  discount?: number | null;
}): number {
  const discountFactor = 1 - (item.discount ?? 0) / 100;
  return grossLineAmount(item) * discountFactor;
}

// The bill foot: gross of all lines, less all line discounts, then GST on the taxable value
// (each line at its own rate, summed into one figure) added on to give the total.
export function purchaseBillSummary(items: PurchaseLine[]) {
  const round = (n: number) => Math.round(n * 100) / 100;
  const gross = items.reduce((sum, item) => sum + grossLineAmount(item), 0);
  const taxable = items.reduce((sum, item) => sum + netLineAmount(item), 0);
  const gst = items.reduce((sum, item) => sum + (netLineAmount(item) * item.gstPercent) / 100, 0);
  return {
    gross: round(gross),
    discount: round(gross - taxable),
    taxable: round(taxable),
    gst: round(gst),
    total: round(taxable + gst),
  };
}

// The bill amount a credit note can be deducted from: the supplier's printed grand total when it
// was entered, otherwise the total calculated from the line items (manual entries often leave the
// invoice total blank).
export function purchaseBillTotal(purchase: {
  invoiceTotal?: number | null;
  items: PurchaseLine[];
}): number {
  if (purchase.invoiceTotal && purchase.invoiceTotal > 0) return purchase.invoiceTotal;
  return purchaseBillSummary(purchase.items).total;
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
