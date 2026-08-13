import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, eq, desc, asc, sql } from "drizzle-orm";
import { batches, medicines, suppliers, stockMovements } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

const movementType = z.enum(["in", "out", "adjustment", "damage", "lost", "expired", "return", "transfer"]);

export const listBatchesForMedicine = createServerFn({ method: "GET" })
  .inputValidator(z.object({ medicineId: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) =>
      db
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
        .orderBy(asc(batches.expiryDate)),
    );
  });

// Running total of stock already written off as expired, per batch, for one medicine. Comes from
// the movement ledger rather than a column on `batches` because that ledger *is* the expired total —
// a batch's own quantity only ever tracks what's still sellable, and drops as write-offs happen.
export const getExpiredTotalsForMedicine = createServerFn({ method: "GET" })
  .inputValidator(z.object({ medicineId: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) =>
      db
        .select({
          batchId: stockMovements.batchId,
          expiredQuantity: sql<number>`coalesce(sum(${stockMovements.quantity}), 0)::int`,
        })
        .from(stockMovements)
        .where(and(eq(stockMovements.medicineId, data.medicineId), eq(stockMovements.type, "expired")))
        .groupBy(stockMovements.batchId),
    );
  });

export const createBatch = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      medicineId: z.number(),
      batchNo: z.string().min(1),
      expiryDate: z.string().min(1),
      manufactureDate: z.string().optional(),
      quantity: z.number().int().min(0),
      // Free/bonus units on top of the billed quantity — folded into the batch's single stored
      // quantity (same convention as Purchase Entry's savePurchase), since batches don't track
      // billed vs. free separately.
      freeQuantity: z.number().int().min(0).optional(),
      purchasePrice: z.number(),
      mrp: z.number(),
      ptr: z.number().optional(),
      pts: z.number().optional(),
      supplierId: z.number().optional(),
      // GST is a medicine-level rate, not per-batch — if provided, this updates the medicine's
      // stored gstPercent (CGST+SGST) as a convenience so it can be fixed while adding stock,
      // without a separate trip to Edit Medicine.
      cgstPercent: z.number().optional(),
      sgstPercent: z.number().optional(),
      remarks: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const totalQuantity = data.quantity + (data.freeQuantity ?? 0);
      const [batch] = await db
        .insert(batches)
        .values({
          medicineId: data.medicineId,
          batchNo: data.batchNo.toUpperCase(),
          expiryDate: data.expiryDate,
          manufactureDate: data.manufactureDate,
          quantity: totalQuantity,
          purchasePrice: data.purchasePrice,
          mrp: data.mrp,
          ptr: data.ptr ?? 0,
          pts: data.pts ?? 0,
          supplierId: data.supplierId ?? null,
        })
        .returning();

      if (data.cgstPercent != null && data.sgstPercent != null) {
        await db
          .update(medicines)
          .set({ gstPercent: data.cgstPercent + data.sgstPercent })
          .where(eq(medicines.id, data.medicineId));
      }

      if (totalQuantity > 0) {
        await db.insert(stockMovements).values({
          medicineId: data.medicineId,
          batchId: batch.id,
          type: "in",
          quantity: totalQuantity,
          reason: data.remarks?.trim() || "Manually added batch",
          referenceType: "manual",
        });
      }
      return { id: batch.id };
    });
  });

export const updateBatch = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number(),
      batchNo: z.string().min(1),
      expiryDate: z.string().min(1),
      manufactureDate: z.string().optional(),
      quantity: z.number().int().min(0),
      purchasePrice: z.number(),
      mrp: z.number(),
      ptr: z.number().optional(),
      pts: z.number().optional(),
      supplierId: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const { id, ...fields } = data;
      await db
        .update(batches)
        .set({ ...fields, batchNo: fields.batchNo.toUpperCase(), supplierId: fields.supplierId ?? null })
        .where(eq(batches.id, id));
      return { id };
    });
  });

export const deleteBatch = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      await db.delete(batches).where(eq(batches.id, data.id));
      return { ok: true };
    });
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
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
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
  });

export const listStockMovements = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().default(100) }).optional())
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) =>
      db
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
        .limit(data?.limit ?? 100),
    );
  });

export const stockSummary = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    const [row] = await db
      .select({
        totalStockValue: sql<number>`coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)`,
        lowStockCount: sql<number>`(select count(*)::int from (select ${batches.medicineId} as mid, sum(${batches.quantity}) as qty from ${batches} group by ${batches.medicineId} having sum(${batches.quantity}) <= 10) t)`,
        outOfStockCount: sql<number>`(select count(*)::int from (select ${batches.medicineId} as mid, sum(${batches.quantity}) as qty from ${batches} group by ${batches.medicineId} having sum(${batches.quantity}) = 0) t)`,
      })
      .from(batches);
    return row;
  });
});
