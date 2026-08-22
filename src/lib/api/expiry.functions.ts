import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { batches, medicines, suppliers } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

const BUCKETS = [7, 15, 30, 60, 90];

export const getExpiryDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    // Units of this batch already written off as expired. Read from the movement ledger rather
    // than a column on `batches`, because a batch's own quantity only tracks what's still
    // sellable — the write-off *reduces* that, so without this the expired stock would vanish
    // from the dashboard the moment it was recorded. stock_movements is RLS-scoped to the
    // tenant like every other table, so the correlated subquery can't read across tenants.
    const expiredQuantity = sql<number>`coalesce((
      select sum(sm.quantity)::int
      from stock_movements sm
      where sm.batch_id = ${batches.id} and sm.type = 'expired'
    ), 0)`;

    const rows = await db
      .select({
        id: batches.id,
        batchNo: batches.batchNo,
        expiryDate: batches.expiryDate,
        manufactureDate: batches.manufactureDate,
        quantity: batches.quantity,
        expiredQuantity,
        purchasePrice: batches.purchasePrice,
        mrp: batches.mrp,
        medicineId: medicines.id,
        medicineName: medicines.name,
        pack: medicines.pack,
        supplierId: suppliers.id,
        supplierName: suppliers.name,
      })
      .from(batches)
      .innerJoin(medicines, sql`${medicines.id} = ${batches.medicineId}`)
      .leftJoin(suppliers, sql`${suppliers.id} = ${batches.supplierId}`)
      // A batch stays on the dashboard once it has expired stock written off against it, even
      // after its sellable quantity has been drawn down to zero — that written-off stock is
      // exactly what still has to be returned to the supplier.
      .where(
        sql`(${batches.quantity} > 0 or ${expiredQuantity} > 0) and ${batches.expiryDate}::date <= CURRENT_DATE + 90`,
      )
      .orderBy(sql`${batches.expiryDate} asc`);

    const now = Date.now();
    const withDays = rows.map((r) => ({
      ...r,
      daysToExpiry: Math.ceil((new Date(r.expiryDate).getTime() - now) / 86_400_000),
      // At-risk value of stock still on the shelf, vs. loss already realised by the write-off.
      estimatedLoss: r.quantity * r.purchasePrice,
      expiredValue: r.expiredQuantity * r.purchasePrice,
    }));

    // Only stock still sellable can be "expiring in N days" — a batch already written off has
    // nothing left to lose, so it belongs in the expired list, not a countdown bucket.
    const buckets = BUCKETS.map((days) => ({
      days,
      items: withDays.filter((r) => r.quantity > 0 && r.daysToExpiry >= 0 && r.daysToExpiry <= days),
    }));

    const expiredThisMonth = withDays.filter((r) => r.daysToExpiry < 0 || r.expiredQuantity > 0);
    const totalEstimatedLoss = withDays
      .filter((r) => r.quantity > 0 && r.daysToExpiry <= 30)
      .reduce((sum, r) => sum + r.estimatedLoss, 0);

    const supplierMap = new Map<string, { supplierId: number | null; supplierName: string; items: typeof withDays }>();
    for (const row of withDays) {
      const key = row.supplierId != null ? String(row.supplierId) : "unknown";
      const name = row.supplierName ?? "Unknown Supplier";
      if (!supplierMap.has(key)) {
        supplierMap.set(key, { supplierId: row.supplierId, supplierName: name, items: [] });
      }
      supplierMap.get(key)!.items.push(row);
    }
    const bySupplier = Array.from(supplierMap.values())
      .map((s) => ({
        ...s,
        count: s.items.length,
        estimatedLoss: s.items.reduce((sum, i) => sum + i.estimatedLoss, 0),
        // The seller's expiry stock: what's been written off against batches they supplied.
        expiredQuantity: s.items.reduce((sum, i) => sum + i.expiredQuantity, 0),
        expiredValue: s.items.reduce((sum, i) => sum + i.expiredValue, 0),
      }))
      .sort((a, b) => b.expiredQuantity - a.expiredQuantity || b.count - a.count);

    return {
      expiringThisMonthCount: withDays.filter((r) => r.quantity > 0 && r.daysToExpiry >= 0 && r.daysToExpiry <= 30)
        .length,
      totalEstimatedLoss,
      totalExpiredQuantity: withDays.reduce((sum, r) => sum + r.expiredQuantity, 0),
      totalExpiredValue: withDays.reduce((sum, r) => sum + r.expiredValue, 0),
      buckets,
      expired: expiredThisMonth,
      all: withDays,
      bySupplier,
    };
  });
});
