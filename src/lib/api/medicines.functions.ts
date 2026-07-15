import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, ilike, or, and, gt, sql, asc, desc } from "drizzle-orm";
import { medicines, batches, suppliers, stockMovements, saleItems, sales } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const listMedicines = createServerFn({ method: "GET" })
  .inputValidator(z.object({ search: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const search = data?.search?.trim();
      const rows = await db
        .select({
          id: medicines.id,
          name: medicines.name,
          brand: medicines.brand,
          company: medicines.company,
          category: medicines.category,
          pack: medicines.pack,
          mrp: medicines.mrp,
          sellingPrice: medicines.sellingPrice,
          purchasePrice: medicines.purchasePrice,
          gstPercent: medicines.gstPercent,
          discount: medicines.discount,
          hsnCode: medicines.hsnCode,
          barcode: medicines.barcode,
          totalStock: sql<number>`coalesce(sum(${batches.quantity}), 0)::int`,
          // The batch a pharmacist should reach for right now — soonest-to-expire among batches
          // that still have stock — plus how many other in-stock batches exist behind it.
          primaryBatchNo: sql<string | null>`(
            select ${batches.batchNo} from ${batches}
            where ${batches.medicineId} = ${medicines.id} and ${batches.quantity} > 0
            order by ${batches.expiryDate} asc limit 1
          )`,
          otherBatchCount: sql<number>`(
            select greatest(count(*)::int - 1, 0) from ${batches}
            where ${batches.medicineId} = ${medicines.id} and ${batches.quantity} > 0
          )`,
        })
        .from(medicines)
        .leftJoin(batches, eq(batches.medicineId, medicines.id))
        .where(
          search
            ? or(
                ilike(medicines.name, `%${search}%`),
                ilike(medicines.company, `%${search}%`),
                ilike(medicines.barcode, `%${search}%`),
              )
            : undefined,
        )
        .groupBy(medicines.id)
        .orderBy(asc(medicines.name));
      return rows;
    });
  });

// Used by Sales/POS: searches medicine name/company/barcode AND batch number, returning
// one row per in-stock batch (not per medicine) so the dropdown can show batch-level detail
// directly. Soonest-to-expire first, so the batch a pharmacist should sell off first is on top.
export const searchMedicineBatches = createServerFn({ method: "GET" })
  .inputValidator(z.object({ search: z.string().min(1) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const term = `%${data.search.trim()}%`;
      return db
        .select({
          medicineId: medicines.id,
          medicineName: medicines.name,
          pack: medicines.pack,
          category: medicines.category,
          batchId: batches.id,
          batchNo: batches.batchNo,
          expiryDate: batches.expiryDate,
          quantity: batches.quantity,
          mrp: batches.mrp,
          discount: medicines.discount,
          gstPercent: medicines.gstPercent,
          supplierId: batches.supplierId,
          supplierName: suppliers.name,
        })
        .from(batches)
        .innerJoin(medicines, eq(batches.medicineId, medicines.id))
        .leftJoin(suppliers, eq(suppliers.id, batches.supplierId))
        .where(
          and(
            gt(batches.quantity, 0),
            or(
              ilike(medicines.name, term),
              ilike(medicines.company, term),
              ilike(medicines.barcode, term),
              ilike(batches.batchNo, term),
            ),
          ),
        )
        .orderBy(asc(batches.expiryDate));
    });
  });

export const getMedicineDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [medicine] = await db.select().from(medicines).where(eq(medicines.id, data.id));
      if (!medicine) return { medicine: null, batches: [], movements: [], recentSales: [] };

      const medicineBatches = await db
        .select({
          id: batches.id,
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
          supplierPhone: suppliers.phone,
          supplierGstNumber: suppliers.gstNumber,
          supplierCreditDays: suppliers.creditDays,
          createdAt: batches.createdAt,
        })
        .from(batches)
        .leftJoin(suppliers, eq(suppliers.id, batches.supplierId))
        .where(eq(batches.medicineId, data.id))
        .orderBy(asc(batches.expiryDate));

      const movements = await db
        .select({
          id: stockMovements.id,
          type: stockMovements.type,
          quantity: stockMovements.quantity,
          reason: stockMovements.reason,
          createdAt: stockMovements.createdAt,
          batchNo: batches.batchNo,
        })
        .from(stockMovements)
        .leftJoin(batches, eq(batches.id, stockMovements.batchId))
        .where(eq(stockMovements.medicineId, data.id))
        .orderBy(desc(stockMovements.createdAt))
        .limit(20);

      const recentSales = await db
        .select({
          id: saleItems.id,
          quantity: saleItems.quantity,
          salePrice: saleItems.salePrice,
          billNumber: sales.billNumber,
          createdAt: sales.createdAt,
        })
        .from(saleItems)
        .innerJoin(sales, eq(sales.id, saleItems.saleId))
        .where(eq(saleItems.medicineId, data.id))
        .orderBy(desc(sales.createdAt))
        .limit(20);

      const totalStock = medicineBatches.reduce((sum, b) => sum + b.quantity, 0);
      const totalStockValue = medicineBatches.reduce((sum, b) => sum + b.quantity * b.purchasePrice, 0);

      return { medicine, batches: medicineBatches, movements, recentSales, totalStock, totalStockValue };
    });
  });

export const upsertMedicine = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      brand: z.string().optional(),
      company: z.string().optional(),
      category: z.string().optional(),
      pack: z.string().optional(),
      mrp: z.number(),
      sellingPrice: z.number(),
      purchasePrice: z.number(),
      gstPercent: z.number(),
      discount: z.number().default(0),
      hsnCode: z.string().optional(),
      barcode: z.string().optional(),
      // Initial stock — only used when creating a new medicine, so the medicine doesn't have
      // to be created blank and then filled in later via Purchase Entry.
      batchNo: z.string().optional(),
      quantity: z.number().optional(),
      expiryDate: z.string().optional(),
      supplierId: z.number().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const { id, batchNo, quantity, expiryDate, supplierId, ...medicineFields } = data;
      if (id) {
        await db.update(medicines).set(medicineFields).where(eq(medicines.id, id));
        return { id };
      }
      const [inserted] = await db.insert(medicines).values(medicineFields).returning();
      if (batchNo && quantity && quantity > 0 && expiryDate) {
        await db.insert(batches).values({
          medicineId: inserted.id,
          batchNo,
          expiryDate,
          quantity,
          purchasePrice: medicineFields.purchasePrice,
          mrp: medicineFields.mrp,
          supplierId: supplierId ?? null,
        });
      }
      return { id: inserted.id };
    });
  });

export const deleteMedicine = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      await db.delete(medicines).where(eq(medicines.id, data.id));
      return { ok: true };
    });
  });
