import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, like, or, sql, asc, desc } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { medicines, batches, suppliers, stockMovements, saleItems, sales } from "../db/schema";

export const listMedicines = createServerFn({ method: "GET" })
  .inputValidator(z.object({ search: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    const db = getDb();
    const search = data?.search?.trim();
    const rows = await db
      .select({
        id: medicines.id,
        name: medicines.name,
        salt: medicines.salt,
        brand: medicines.brand,
        company: medicines.company,
        category: medicines.category,
        pack: medicines.pack,
        mrp: medicines.mrp,
        sellingPrice: medicines.sellingPrice,
        purchasePrice: medicines.purchasePrice,
        gstPercent: medicines.gstPercent,
        hsnCode: medicines.hsnCode,
        barcode: medicines.barcode,
        schedule: medicines.schedule,
        rackNumber: medicines.rackNumber,
        totalStock: sql<number>`coalesce(sum(${batches.quantity}), 0)`,
      })
      .from(medicines)
      .leftJoin(batches, eq(batches.medicineId, medicines.id))
      .where(
        search
          ? or(
              like(medicines.name, `%${search}%`),
              like(medicines.salt, `%${search}%`),
              like(medicines.company, `%${search}%`),
              like(medicines.barcode, `%${search}%`),
            )
          : undefined,
      )
      .groupBy(medicines.id)
      .orderBy(asc(medicines.name));
    return rows;
  });

export const getMedicineDetail = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
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

export const upsertMedicine = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      salt: z.string().optional(),
      brand: z.string().optional(),
      company: z.string().optional(),
      category: z.string().optional(),
      pack: z.string().optional(),
      mrp: z.number(),
      sellingPrice: z.number(),
      purchasePrice: z.number(),
      gstPercent: z.number(),
      hsnCode: z.string().optional(),
      barcode: z.string().optional(),
      storage: z.string().optional(),
      schedule: z.string().optional(),
      rackNumber: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    if (data.id) {
      await db.update(medicines).set(data).where(eq(medicines.id, data.id));
      return { id: data.id };
    }
    const [inserted] = await db.insert(medicines).values(data).returning();
    return { id: inserted.id };
  });
