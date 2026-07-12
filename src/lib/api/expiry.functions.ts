import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { batches, medicines, suppliers } from "../db/schema";

const BUCKETS = [7, 15, 30, 60, 90];

export const getExpiryDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();

  const rows = await db
    .select({
      id: batches.id,
      batchNo: batches.batchNo,
      expiryDate: batches.expiryDate,
      quantity: batches.quantity,
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
    .where(sql`${batches.quantity} > 0 and ${batches.expiryDate} <= date('now', '+90 days')`)
    .orderBy(sql`${batches.expiryDate} asc`);

  const now = Date.now();
  const withDays = rows.map((r) => ({
    ...r,
    daysToExpiry: Math.ceil((new Date(r.expiryDate).getTime() - now) / 86_400_000),
    estimatedLoss: r.quantity * r.purchasePrice,
  }));

  const buckets = BUCKETS.map((days) => ({
    days,
    items: withDays.filter((r) => r.daysToExpiry >= 0 && r.daysToExpiry <= days),
  }));

  const expiredThisMonth = withDays.filter((r) => r.daysToExpiry < 0);
  const totalEstimatedLoss = withDays
    .filter((r) => r.daysToExpiry <= 30)
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
    .map((s) => ({ ...s, count: s.items.length, estimatedLoss: s.items.reduce((sum, i) => sum + i.estimatedLoss, 0) }))
    .sort((a, b) => b.count - a.count);

  return {
    expiringThisMonthCount: withDays.filter((r) => r.daysToExpiry >= 0 && r.daysToExpiry <= 30).length,
    totalEstimatedLoss,
    buckets,
    expired: expiredThisMonth,
    all: withDays,
    bySupplier,
  };
});
