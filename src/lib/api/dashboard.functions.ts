import { createServerFn } from "@tanstack/react-start";
import { sql } from "drizzle-orm";
import { sales, saleItems, purchases, batches, medicines } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    const [todaysSales] = await db
      .select({ total: sql<number>`coalesce(sum(${sales.total}), 0)`, count: sql<number>`count(*)::int` })
      .from(sales)
      .where(sql`${sales.createdAt}::date = CURRENT_DATE`);

    const [todaysPurchases] = await db
      .select({ total: sql<number>`coalesce(sum(${purchases.invoiceTotal}), 0)`, count: sql<number>`count(*)::int` })
      .from(purchases)
      .where(sql`${purchases.createdAt}::date = CURRENT_DATE`);

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
      .where(sql`${batches.expiryDate}::date <= CURRENT_DATE + 30 and ${batches.quantity} > 0`);

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
      .where(sql`${sales.createdAt}::date = CURRENT_DATE`);

    const topSelling = await db
      .select({
        medicineId: saleItems.medicineId,
        name: medicines.name,
        totalQty: sql<number>`sum(${saleItems.quantity})::int`,
      })
      .from(saleItems)
      .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
      .innerJoin(medicines, sql`${medicines.id} = ${saleItems.medicineId}`)
      .where(sql`${sales.createdAt}::date >= CURRENT_DATE - 30`)
      .groupBy(saleItems.medicineId, medicines.name)
      .orderBy(sql`sum(${saleItems.quantity}) desc`)
      .limit(5);

    const monthlySales = await db
      .select({
        month: sql<string>`to_char(${sales.createdAt}::date, 'YYYY-MM')`,
        total: sql<number>`sum(${sales.total})`,
      })
      .from(sales)
      .where(sql`${sales.createdAt}::date >= (CURRENT_DATE - INTERVAL '6 months')::date`)
      .groupBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM')`);

    const monthlyPurchases = await db
      .select({
        month: sql<string>`to_char(${purchases.createdAt}::date, 'YYYY-MM')`,
        total: sql<number>`sum(${purchases.invoiceTotal})`,
      })
      .from(purchases)
      .where(sql`${purchases.createdAt}::date >= (CURRENT_DATE - INTERVAL '6 months')::date`)
      .groupBy(sql`to_char(${purchases.createdAt}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${purchases.createdAt}::date, 'YYYY-MM')`);

    const monthlyProfit = await db
      .select({
        month: sql<string>`to_char(${sales.createdAt}::date, 'YYYY-MM')`,
        profit: sql<number>`sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity})`,
      })
      .from(saleItems)
      .innerJoin(sales, sql`${sales.id} = ${saleItems.saleId}`)
      .innerJoin(batches, sql`${batches.id} = ${saleItems.batchId}`)
      .where(sql`${sales.createdAt}::date >= (CURRENT_DATE - INTERVAL '6 months')::date`)
      .groupBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM')`)
      .orderBy(sql`to_char(${sales.createdAt}::date, 'YYYY-MM')`);

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
});
