// Shared by the purchase entry screen and savePurchase, so the credit-note deduction the user
// sees before saving is exactly the one the server records.

// Trade discount is applied before GST, matching how suppliers actually compute it on the
// printed invoice — the "Amount" column and GST value both need to reflect the discounted cost,
// not the raw rate x quantity.
export function netLineAmount(item: {
  purchasePrice: number;
  quantity: number;
  discount?: number | null;
}): number {
  const discountFactor = 1 - (item.discount ?? 0) / 100;
  return item.purchasePrice * item.quantity * discountFactor;
}

// The bill amount a credit note can be deducted from: the supplier's printed grand total when it
// was entered, otherwise the line items' own total including GST (manual entries often leave the
// invoice total blank).
export function purchaseBillTotal(purchase: {
  invoiceTotal?: number | null;
  items: {
    purchasePrice: number;
    quantity: number;
    discount?: number | null;
    gstPercent: number;
  }[];
}): number {
  if (purchase.invoiceTotal && purchase.invoiceTotal > 0) return purchase.invoiceTotal;
  return purchase.items.reduce(
    (sum, item) => sum + netLineAmount(item) * (1 + item.gstPercent / 100),
    0,
  );
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
