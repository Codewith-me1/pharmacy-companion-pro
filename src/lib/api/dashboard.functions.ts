import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { sales, saleItems, purchases, batches, medicines } from "../db/schema";

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();

  const [todaysSales] = await db
    .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)`, count: sql<number>`count(*)` })
    .from(sales)
    .where(sql`date(${sales.createdAt}) = date('now')`);

  const [todaysPurchases] = await db
    .select({ total: sql<number>`coalesce(sum(${purchases.invoiceTotal}), 0)`, count: sql<number>`count(*)` })
    .from(purchases)
    .where(sql`date(${purchases.createdAt}) = date('now')`);

  const [stockValue] = await db
    .select({ value: sql<number>`coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)` })
    .from(batches);

  const lowStockRows = await db
    .select({ medicineId: batches.medicineId, qty: sql<number>`sum(${batches.quantity})` })
    .from(batches)
    .groupBy(batches.medicineId)
    .having(sql`sum(${batches.quantity}) <= 10 and sum(${batches.quantity}) > 0`);

  const outOfStockRows = await db
    .select({ medicineId: batches.medicineId, qty: sql<number>`sum(${batches.quantity})` })
    .from(batches)
    .groupBy(batches.medicineId)
    .having(sql`sum(${batches.quantity}) = 0`);

  const expiringRows = await db
    .select({ id: batches.id })
    .from(batches)
    .where(sql`${batches.expiryDate} <= date('now', '+30 days') and ${batches.quantity} > 0`);

  const [pendingPayments] = await db
    .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)` })
    .from(sales)
    .where(sql`${sales.paymentStatus} != 'paid'`);

  const [todaysProfit] = await db
    .select({
      profit: sql<number>`coalesce(sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity}), 0)`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
    .innerJoin(batches, sql`${batches.id} = ${saleItems.batchId}`)
    .where(sql`date(${sales.createdAt}) = date('now')`);

  const topSelling = await db
    .select({
      medicineId: saleItems.medicineId,
      name: medicines.name,
      totalQty: sql<number>`sum(${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
    .innerJoin(medicines, sql`${medicines.id} = ${saleItems.medicineId}`)
    .where(sql`${sales.createdAt} >= date('now', '-30 days')`)
    .groupBy(saleItems.medicineId)
    .orderBy(sql`sum(${saleItems.quantity}) desc`)
    .limit(5);

  const monthlySales = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${sales.createdAt})`,
      total: sql<number>`sum(${sales.total})`,
    })
    .from(sales)
    .where(sql`${sales.createdAt} >= date('now', '-6 months')`)
    .groupBy(sql`strftime('%Y-%m', ${sales.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${sales.createdAt})`);

  const monthlyPurchases = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${purchases.createdAt})`,
      total: sql<number>`sum(${purchases.invoiceTotal})`,
    })
    .from(purchases)
    .where(sql`${purchases.createdAt} >= date('now', '-6 months')`)
    .groupBy(sql`strftime('%Y-%m', ${purchases.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${purchases.createdAt})`);

  const monthlyProfit = await db
    .select({
      month: sql<string>`strftime('%Y-%m', ${sales.createdAt})`,
      profit: sql<number>`sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity})`,
    })
    .from(saleItems)
    .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
    .innerJoin(batches, sql`${batches.id} = ${saleItems.batchId}`)
    .where(sql`${sales.createdAt} >= date('now', '-6 months')`)
    .groupBy(sql`strftime('%Y-%m', ${sales.createdAt})`)
    .orderBy(sql`strftime('%Y-%m', ${sales.createdAt})`);

  return {
    todaysSales: { total: todaysSales.total, count: todaysSales.count },
    todaysPurchases: { total: todaysPurchases.total, count: todaysPurchases.count },
    stockValue: stockValue.value,
    lowStockCount: lowStockRows.length,
    outOfStockCount: outOfStockRows.length,
    expiringCount: expiringRows.length,
    pendingPayments: pendingPayments.total,
    todaysProfit: todaysProfit.profit,
    topSelling,
    monthlySales,
    monthlyPurchases,
    monthlyProfit,
  };
});
