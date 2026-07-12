import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { sales, saleItems, purchases, purchaseItems, batches, medicines, suppliers } from "../db/schema";

const rangeInput = z.object({ from: z.string().optional(), to: z.string().optional() }).optional();

export const salesReport = createServerFn({ method: "GET" })
  .inputValidator(rangeInput)
  .handler(async ({ data }) => {
    const db = getDb();
    return db
      .select({
        id: sales.id,
        billNumber: sales.billNumber,
        billType: sales.billType,
        subtotal: sales.subtotal,
        gstAmount: sales.gstAmount,
        total: sales.total,
        paymentMode: sales.paymentMode,
        createdAt: sales.createdAt,
      })
      .from(sales)
      .where(
        sql`${sales.createdAt}::date >= ${data?.from ?? "1970-01-01"}::date and ${sales.createdAt}::date <= ${data?.to ?? "2999-01-01"}::date`,
      )
      .orderBy(sql`${sales.createdAt} desc`);
  });

export const purchaseReport = createServerFn({ method: "GET" })
  .inputValidator(rangeInput)
  .handler(async ({ data }) => {
    const db = getDb();
    return db
      .select({
        id: purchases.id,
        invoiceNumber: purchases.invoiceNumber,
        invoiceTotal: purchases.invoiceTotal,
        taxAmount: purchases.taxAmount,
        createdAt: purchases.createdAt,
        supplierName: suppliers.name,
      })
      .from(purchases)
      .leftJoin(suppliers, sql`${suppliers.id} = ${purchases.supplierId}`)
      .where(
        sql`${purchases.createdAt}::date >= ${data?.from ?? "1970-01-01"}::date and ${purchases.createdAt}::date <= ${data?.to ?? "2999-01-01"}::date`,
      )
      .orderBy(sql`${purchases.createdAt} desc`);
  });

export const gstReport = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const outputGst = await db
    .select({
      month: sql<string>`to_char(${sales.createdAt}::date, 'YYYY-MM')`,
      gstCollected: sql<number>`sum(${sales.gstAmount})`,
    })
    .from(sales)
    .groupBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM') desc`);

  const inputGst = await db
    .select({
      month: sql<string>`to_char(${purchases.createdAt}::date, 'YYYY-MM')`,
      gstPaid: sql<number>`sum(${purchases.taxAmount})`,
    })
    .from(purchases)
    .groupBy(sql`to_char(${purchases.createdAt}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${purchases.createdAt}::date, 'YYYY-MM') desc`);

  return { outputGst, inputGst };
});

export const profitLossReport = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  return db
    .select({
      month: sql<string>`to_char(${sales.createdAt}::date, 'YYYY-MM')`,
      revenue: sql<number>`sum(${saleItems.salePrice} * ${saleItems.quantity})`,
      cost: sql<number>`sum(${batches.purchasePrice} * ${saleItems.quantity})`,
      profit: sql<number>`sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
    .innerJoin(batches, sql`${batches.id} = ${saleItems.batchId}`)
    .groupBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM')`)
    .orderBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM') desc`);
});

export const inventoryMovementReport = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const fastMoving = await db
    .select({
      medicineId: saleItems.medicineId,
      name: medicines.name,
      totalQty: sql<number>`sum(${saleItems.quantity})::int`,
    })
    .from(saleItems)
    .innerJoin(medicines, sql`${medicines.id} = ${saleItems.medicineId}`)
    .where(sql`${saleItems.saleId} in (select id from sales where sales.created_at::date >= CURRENT_DATE - 60)`)
    .groupBy(saleItems.medicineId, medicines.name)
    .orderBy(sql`sum(${saleItems.quantity}) desc`)
    .limit(10);

  const deadStock = await db
    .select({ id: medicines.id, name: medicines.name, totalStock: sql<number>`coalesce(sum(${batches.quantity}), 0)` })
    .from(medicines)
    .leftJoin(batches, sql`${batches.medicineId} = ${medicines.id}`)
    .where(
      sql`${medicines.id} not in (select medicine_id from sale_items where sale_id in (select id from sales where sales.created_at::date >= CURRENT_DATE - 90))`,
    )
    .groupBy(medicines.id)
    .having(sql`coalesce(sum(${batches.quantity}), 0) > 0`);

  return { fastMoving, deadStock };
});

export const companyWiseReport = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  return db
    .select({
      company: medicines.company,
      totalStockValue: sql<number>`coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)`,
      medicineCount: sql<number>`count(distinct ${medicines.id})::int`,
    })
    .from(medicines)
    .leftJoin(batches, sql`${batches.medicineId} = ${medicines.id}`)
    .groupBy(medicines.company);
});

export const categoryWiseReport = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  return db
    .select({
      category: medicines.category,
      totalStockValue: sql<number>`coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)`,
      medicineCount: sql<number>`count(distinct ${medicines.id})::int`,
    })
    .from(medicines)
    .leftJoin(batches, sql`${batches.medicineId} = ${medicines.id}`)
    .groupBy(medicines.category);
});

export const purchaseItemFlagsReport = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const rows = await db
    .select({
      id: purchaseItems.id,
      medicineNameRaw: purchaseItems.medicineNameRaw,
      flags: purchaseItems.flags,
      createdAt: purchaseItems.createdAt,
    })
    .from(purchaseItems)
    .where(sql`${purchaseItems.flags} is not null and ${purchaseItems.flags} != '[]'`)
    .orderBy(sql`${purchaseItems.createdAt} desc`)
    .limit(50);
  return rows.map((r) => ({ ...r, flags: JSON.parse(r.flags ?? "[]") as string[] }));
});
