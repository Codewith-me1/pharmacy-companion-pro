import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { suppliers, purchases, batches, medicines } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const listSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => db.select().from(suppliers).orderBy(suppliers.name));
});

export const getSupplier = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, data.id));
      const purchaseHistory = await db
        .select()
        .from(purchases)
        .where(eq(purchases.supplierId, data.id))
        .orderBy(desc(purchases.createdAt));

      // Every medicine ever bought from this supplier, batch by batch, with its expiry status —
      // so clicking a supplier answers "what have we bought from them, and how much is left/expiring".
      const medicinesPurchased = await db
        .select({
          batchId: batches.id,
          medicineId: medicines.id,
          medicineName: medicines.name,
          pack: medicines.pack,
          category: medicines.category,
          batchNo: batches.batchNo,
          expiryDate: batches.expiryDate,
          quantity: batches.quantity,
          purchasePrice: batches.purchasePrice,
          mrp: batches.mrp,
          purchasedAt: batches.createdAt,
        })
        .from(batches)
        .innerJoin(medicines, eq(medicines.id, batches.medicineId))
        .where(eq(batches.supplierId, data.id))
        .orderBy(desc(batches.createdAt));

      return { supplier, purchaseHistory, medicinesPurchased };
    });
  });

export const upsertSupplier = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      gstNumber: z.string().optional(),
      dlNo: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      creditDays: z.number().default(0),
      outstanding: z.number().default(0),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      if (data.id) {
        await db.update(suppliers).set(data).where(eq(suppliers.id, data.id));
        return { id: data.id };
      }
      const [inserted] = await db.insert(suppliers).values(data).returning();
      return { id: inserted.id };
    });
  });

export const bulkImportSuppliers = createServerFn({ method: "POST" })
  .inputValidator(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const [index, row] of data.rows.entries()) {
        const rowNumber = index + 2;
        const name = row.name?.trim();
        if (!name) {
          skipped++;
          errors.push(`Row ${rowNumber}: missing supplier name — skipped.`);
          continue;
        }
        await db.insert(suppliers).values({
          name,
          gstNumber: row.gstNumber?.trim() || undefined,
          dlNo: row.dlNo?.trim() || undefined,
          address: row.address?.trim() || undefined,
          phone: row.phone?.trim() || undefined,
          creditDays: Number(row.creditDays) || 0,
        });
        created++;
      }

      return { created, skipped, errors };
    });
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      await db.delete(suppliers).where(eq(suppliers.id, data.id));
      return { ok: true };
    });
  });
