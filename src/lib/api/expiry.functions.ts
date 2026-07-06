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

  return {
    expiringThisMonthCount: withDays.filter((r) => r.daysToExpiry >= 0 && r.daysToExpiry <= 30).length,
    totalEstimatedLoss,
    buckets,
    expired: expiredThisMonth,
    all: withDays,
  };
});
