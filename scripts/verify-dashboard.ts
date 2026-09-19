/**
 * Proves the one-round-trip dashboard query returns exactly what the original twelve queries did.
 *
 *   npm run db:verify-dashboard
 *
 * Seeds a throwaway tenant with representative data (sales today and in past months, purchases,
 * batches that are low/empty/expiring, sale items with a margin), runs BOTH implementations
 * against it, and requires the results to be byte-identical. Everything it creates is deleted
 * afterwards, including on failure.
 */
import process from "node:process";
import { sql } from "drizzle-orm";
import { Client } from "pg";
import { getDb } from "../src/lib/db/client.server";
import { withTenant } from "../src/lib/db/tenant.server";
import { dashboardStats } from "../src/lib/db/dashboard-stats.server";
import { sslConfigFor } from "../src/lib/db/ssl.server";
import {
  users,
  medicines,
  suppliers,
  batches,
  sales,
  saleItems,
  purchases,
} from "../src/lib/db/schema";

/** The ORIGINAL twelve-query implementation, kept verbatim as the reference to compare against. */
async function originalDashboardStats(db: ReturnType<typeof getDb>) {
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
}

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString();
const dateOnly = (daysAhead: number) => iso(-daysAhead).slice(0, 10);

const db = getDb();
let tenantId = 0;

try {
  const [user] = await db
    .insert(users)
    .values({
      email: `dashboard-verify-${Date.now()}@example.test`,
      passwordHash: "x",
      name: "Dashboard Verify",
    })
    .returning();
  tenantId = user.id;

  await withTenant(tenantId, async (tx) => {
    const [supplier] = await tx.insert(suppliers).values({ name: "VERIFY SUPPLIER" }).returning();
    const [medA] = await tx
      .insert(medicines)
      .values({ name: "VERIFY MED A", mrp: 100, sellingPrice: 90, purchasePrice: 60 })
      .returning();
    const [medB] = await tx
      .insert(medicines)
      .values({ name: "VERIFY MED B", mrp: 50, sellingPrice: 45, purchasePrice: 30 })
      .returning();

    // low stock, expiring soon
    const [batchA] = await tx
      .insert(batches)
      .values({
        medicineId: medA.id, batchNo: "VA1", expiryDate: dateOnly(15), quantity: 8,
        purchasePrice: 60, mrp: 100, supplierId: supplier.id,
      })
      .returning();
    // out of stock
    await tx.insert(batches).values({
      medicineId: medB.id, batchNo: "VB1", expiryDate: dateOnly(400), quantity: 0,
      purchasePrice: 30, mrp: 50, supplierId: supplier.id,
    });
    // healthy stock, far expiry
    const [batchC] = await tx
      .insert(batches)
      .values({
        medicineId: medA.id, batchNo: "VA2", expiryDate: dateOnly(500), quantity: 100,
        purchasePrice: 55, mrp: 100, supplierId: supplier.id,
      })
      .returning();

    // sales: one today (paid), one today (pending), one 40 days ago
    for (const [daysAgo, status, total] of [[0, "paid", 270], [0, "pending", 90], [40, "paid", 180]] as const) {
      const [sale] = await tx
        .insert(sales)
        .values({ billNumber: `V-${daysAgo}-${status}`, total, paymentStatus: status, createdAt: iso(daysAgo) })
        .returning();
      await tx.insert(saleItems).values({
        saleId: sale.id, medicineId: medA.id, batchId: daysAgo === 40 ? batchC.id : batchA.id,
        quantity: daysAgo === 40 ? 2 : 3, salePrice: 90,
      });
    }

    await tx.insert(purchases).values({
      supplierId: supplier.id, invoiceNumber: "VP-1", invoiceTotal: 1200, createdAt: iso(0),
    });
    await tx.insert(purchases).values({
      supplierId: supplier.id, invoiceNumber: "VP-2", invoiceTotal: 800, createdAt: iso(70),
    });
  });

  const before = await withTenant(tenantId, (tx) => originalDashboardStats(tx));
  const after = await withTenant(tenantId, (tx) => dashboardStats(tx));

  const a = JSON.stringify(before, null, 2);
  const b = JSON.stringify(after, null, 2);

  if (a === b) {
    console.log("IDENTICAL — the single-round-trip query matches the original twelve queries.\n");
    console.log(b);
  } else {
    console.log("MISMATCH\n");
    console.log("--- original (12 queries) ---\n" + a);
    console.log("\n--- new (1 query) ---\n" + b);
    process.exitCode = 1;
  }
} finally {
  if (tenantId) {
    const url = process.env.DATABASE_URL!;
    const admin = new Client({ connectionString: url, ssl: sslConfigFor(url) });
    await admin.connect();
    for (const table of ["sale_items", "sales", "purchase_items", "purchases", "stock_movements", "batches", "medicines", "suppliers", "business_settings"]) {
      await admin.query(`delete from "${table}" where owner_id = $1`, [tenantId]);
    }
    await admin.query(`delete from users where id = $1`, [tenantId]);
    await admin.end();
    console.log(`\ncleaned up throwaway tenant ${tenantId}`);
  }
  process.exit(process.exitCode ?? 0);
}
