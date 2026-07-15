import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, asc, sql } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { batches, medicines, suppliers, stockMovements } from "../db/schema";

const movementType = z.enum(["in", "out", "adjustment", "damage", "lost", "expired", "return", "transfer"]);

export const listBatchesForMedicine = createServerFn({ method: "GET" })
  .inputValidator(z.object({ medicineId: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
    return db
      .select({
        id: batches.id,
        medicineId: batches.medicineId,
        batchNo: batches.batchNo,
        expiryDate: batches.expiryDate,
        manufactureDate: batches.manufactureDate,
        quantity: batches.quantity,
        reservedQuantity: batches.reservedQuantity,
        purchasePrice: batches.purchasePrice,
        mrp: batches.mrp,
        ptr: batches.ptr,
        pts: batches.pts,
        supplierId: batches.supplierId,
        supplierName: suppliers.name,
        purchaseId: batches.purchaseId,
        discount: medicines.discount,
        gstPercent: medicines.gstPercent,
        createdAt: batches.createdAt,
      })
      .from(batches)
      .innerJoin(medicines, eq(medicines.id, batches.medicineId))
      .leftJoin(suppliers, eq(suppliers.id, batches.supplierId))
      .where(eq(batches.medicineId, data.medicineId))
      .orderBy(asc(batches.expiryDate));
  });

export const recordStockMovement = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      medicineId: z.number(),
      batchId: z.number(),
      type: movementType,
      quantity: z.number().int(),
      reason: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const [batch] = await db.select().from(batches).where(eq(batches.id, data.batchId));
    if (!batch) throw new Error("Batch not found");

    const delta = ["in", "return"].includes(data.type) ? data.quantity : -data.quantity;
    const nextQuantity = data.type === "adjustment" ? data.quantity : batch.quantity + delta;
    if (nextQuantity < 0) throw new Error("Resulting stock cannot be negative");

    await db.update(batches).set({ quantity: nextQuantity }).where(eq(batches.id, data.batchId));
    await db.insert(stockMovements).values({
      medicineId: data.medicineId,
      batchId: data.batchId,
      type: data.type,
      quantity: data.type === "adjustment" ? nextQuantity - batch.quantity : data.quantity,
      reason: data.reason,
      referenceType: "manual",
    });
    return { newQuantity: nextQuantity };
  });

export const listStockMovements = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().default(100) }).optional())
  .handler(async ({ data }) => {
    const db = getDb();
    return db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        quantity: stockMovements.quantity,
        reason: stockMovements.reason,
        createdAt: stockMovements.createdAt,
        medicineName: medicines.name,
        batchNo: batches.batchNo,
      })
      .from(stockMovements)
      .innerJoin(medicines, eq(medicines.id, stockMovements.medicineId))
      .leftJoin(batches, eq(batches.id, stockMovements.batchId))
      .orderBy(desc(stockMovements.createdAt))
      .limit(data?.limit ?? 100);
  });

export const stockSummary = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const [row] = await db
    .select({
      totalStockValue: sql<number>`coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)`,
      lowStockCount: sql<number>`(select count(*)::int from (select ${batches.medicineId} as mid, sum(${batches.quantity}) as qty from ${batches} group by ${batches.medicineId} having sum(${batches.quantity}) <= 10) t)`,
      outOfStockCount: sql<number>`(select count(*)::int from (select ${batches.medicineId} as mid, sum(${batches.quantity}) as qty from ${batches} group by ${batches.medicineId} having sum(${batches.quantity}) = 0) t)`,
    })
    .from(batches);
  return row;
});
