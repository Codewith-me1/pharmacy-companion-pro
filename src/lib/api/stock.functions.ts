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

// Batch expiry dates arrive from wholesaler spreadsheets in whatever shape the supplier's system
// prints: 2027-11-30, 30/11/2027, 30-11-2027, or — most commonly on a strip — just 11/2027 or
// 11/27. Normalises all of them to YYYY-MM-DD, taking the LAST day of the month for the
// month-only forms, since a batch marked "11/27" is sellable through the whole of November.
// Returns null when the value cannot be read as a date at all, so the row is reported rather than
// silently imported with a wrong expiry.
export function normaliseExpiryDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const lastDayOf = (year: number, month: number) => {
    if (month < 1 || month > 12) return null;
    const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  };
  // Two-digit years: pharmacy expiry dates are always in the future, so 27 means 2027.
  const fullYear = (y: string) => (y.length === 2 ? 2000 + Number(y) : Number(y));

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (m) {
    const [, y, mo, d] = m;
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(value);
  if (m) {
    const [, d, mo, y] = m;
    if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return null;
    return `${fullYear(y)}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  m = /^(\d{1,2})[/-](\d{2}|\d{4})$/.exec(value);
  if (m) {
    const [, mo, y] = m;
    return lastDayOf(fullYear(y), Number(mo));
  }
  m = /^(\d{4})-(\d{1,2})$/.exec(value);
  if (m) {
    const [, y, mo] = m;
    return lastDayOf(Number(y), Number(mo));
  }
  return null;
}

// Bulk import of opening stock: one row per batch. Deliberately does NOT create medicines it has
// not seen — a batch needs a medicine's pricing, GST rate and pack to be meaningful, and guessing
// them from a stock file is how duplicate near-identical medicines get created. Rows naming an
// unknown medicine are reported so the user can import the medicine master first (Inventory ->
// Import CSV) and re-run.
export const bulkImportBatches = createServerFn({ method: "POST" })
  .inputValidator(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      // Load the tenant's medicines and suppliers once, rather than a lookup query per row: an
      // opening-stock file is hundreds of rows and each round trip to the database costs far more
      // than the comparison does.
      const knownMedicines = await db.select({ id: medicines.id, name: medicines.name }).from(medicines);
      const knownSuppliers = await db.select({ id: suppliers.id, name: suppliers.name }).from(suppliers);
      const medicineByName = new Map(knownMedicines.map((m) => [m.name.trim().toLowerCase(), m.id]));
      const supplierByName = new Map(knownSuppliers.map((s) => [s.name.trim().toLowerCase(), s.id]));

      const existing = await db
        .select({ medicineId: batches.medicineId, batchNo: batches.batchNo })
        .from(batches);
      const seen = new Set(existing.map((b) => `${b.medicineId}::${b.batchNo.trim().toUpperCase()}`));

      for (const [index, row] of data.rows.entries()) {
        const rowNumber = index + 2; // +1 for the header row, +1 because spreadsheets start at 1
        const medicineName = row.medicineName?.trim();
        const batchNo = row.batchNo?.trim().toUpperCase();
        const expiryRaw = row.expiryDate?.trim();

        if (!medicineName || !batchNo || !expiryRaw) {
          skipped++;
          errors.push(`Row ${rowNumber}: medicine name, batch number and expiry date are all required — skipped.`);
          continue;
        }

        const medicineId = medicineByName.get(medicineName.toLowerCase());
        if (!medicineId) {
          skipped++;
          errors.push(
            `Row ${rowNumber}: no medicine named "${medicineName}" — add it in Inventory first, then re-import.`,
          );
          continue;
        }

        const expiryDate = normaliseExpiryDate(expiryRaw);
        if (!expiryDate) {
          skipped++;
          errors.push(`Row ${rowNumber}: could not read "${expiryRaw}" as an expiry date — skipped.`);
          continue;
        }

        // Re-running the same file must not double the stock on hand.
        const key = `${medicineId}::${batchNo}`;
        if (seen.has(key)) {
          skipped++;
          errors.push(`Row ${rowNumber}: batch ${batchNo} already exists for ${medicineName} — skipped.`);
          continue;
        }

        let supplierId: number | undefined;
        const supplierName = row.supplierName?.trim();
        if (supplierName) {
          supplierId = supplierByName.get(supplierName.toLowerCase());
          if (!supplierId) {
            // Not fatal: the stock is real even if the supplier record is not set up yet.
            errors.push(
              `Row ${rowNumber}: supplier "${supplierName}" not found — batch imported without a supplier.`,
            );
          }
        }

        const quantity = Math.max(0, Math.trunc(Number(row.quantity) || 0));
        const [batch] = await db
          .insert(batches)
          .values({
            medicineId,
            batchNo,
            expiryDate,
            manufactureDate: row.manufactureDate?.trim()
              ? (normaliseExpiryDate(row.manufactureDate.trim()) ?? undefined)
              : undefined,
            quantity,
            purchasePrice: Number(row.purchasePrice) || 0,
            mrp: Number(row.mrp) || 0,
            supplierId: supplierId ?? null,
          })
          .returning();

        // Same ledger entry createBatch writes, so imported stock is accounted for identically to
        // stock added by hand and the Stock Movements history explains where it came from.
        if (quantity > 0) {
          await db.insert(stockMovements).values({
            medicineId,
            batchId: batch.id,
            type: "in",
            quantity,
            reason: "Imported from CSV",
            referenceType: "import",
          });
        }

        seen.add(key);
        created++;
      }

      return { created, skipped, errors };
    });
  });
