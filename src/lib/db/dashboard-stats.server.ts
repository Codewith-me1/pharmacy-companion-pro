import { sql } from "drizzle-orm";
import { sales, saleItems, purchases, batches, medicines } from "./schema";
import type { getDb } from "./client.server";

/**
 * The whole dashboard in ONE database round trip.
 *
 * This used to be twelve separate queries inside the tenant transaction. Postgres answered each in
 * a millisecond or two, but every one is a separate network round trip, and the round trip — not
 * the query — is what costs: measured at ~155ms to the current region, twelve of them is close to
 * two seconds of the home page doing nothing but waiting. Three of those queries also pulled whole
 * row sets across the wire only to call `.length` on them.
 *
 * Postgres computes independent scalars and aggregates in a single statement perfectly happily, so
 * they are gathered as subqueries of one SELECT. Row sets come back as JSON arrays, which
 * node-postgres parses; every money column in this schema is double precision (never numeric), so
 * values arrive as JS numbers exactly as they did before.
 *
 * Lives here rather than in dashboard.functions.ts so scripts/verify-dashboard.ts can call it
 * directly and compare it against the original twelve queries on identical data.
 */
/** Shape of the single row the query above returns. Aliases are snake_case; the JSON columns are
 * parsed by node-postgres into these arrays. */
interface DashboardRow {
  todays_sales_total: number;
  todays_sales_count: number;
  todays_purchases_total: number;
  todays_purchases_count: number;
  stock_value: number;
  low_stock_count: number;
  out_of_stock_count: number;
  expiring_count: number;
  pending_payments: number;
  todays_profit: number;
  top_selling: { medicineId: number; name: string; totalQty: number }[];
  monthly_sales: { month: string; total: number }[];
  monthly_purchases: { month: string; total: number }[];
  monthly_profit: { month: string; profit: number }[];
}

export async function dashboardStats(db: ReturnType<typeof getDb>) {
  const result = await db.execute(sql`
    select
      (select coalesce(sum(${sales.total}), 0) from ${sales}
        where ${sales.createdAt}::date = CURRENT_DATE) as todays_sales_total,
      (select count(*)::int from ${sales}
        where ${sales.createdAt}::date = CURRENT_DATE) as todays_sales_count,

      (select coalesce(sum(${purchases.invoiceTotal}), 0) from ${purchases}
        where ${purchases.createdAt}::date = CURRENT_DATE) as todays_purchases_total,
      (select count(*)::int from ${purchases}
        where ${purchases.createdAt}::date = CURRENT_DATE) as todays_purchases_count,

      (select coalesce(sum(${batches.quantity} * ${batches.purchasePrice}), 0)
         from ${batches}) as stock_value,

      -- Counted in the database instead of fetching every row to measure its length.
      (select count(*)::int from (
         select ${batches.medicineId} from ${batches}
          group by ${batches.medicineId}
         having sum(${batches.quantity}) <= 10 and sum(${batches.quantity}) > 0
       ) t) as low_stock_count,
      (select count(*)::int from (
         select ${batches.medicineId} from ${batches}
          group by ${batches.medicineId}
         having sum(${batches.quantity}) = 0
       ) t) as out_of_stock_count,
      (select count(*)::int from ${batches}
        where ${batches.expiryDate}::date <= CURRENT_DATE + 30 and ${batches.quantity} > 0)
        as expiring_count,

      (select coalesce(sum(${sales.total}), 0) from ${sales}
        where ${sales.paymentStatus} != 'paid') as pending_payments,

      (select coalesce(sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity}), 0)
         from ${saleItems}
         join ${sales} on ${sales.id} = ${saleItems.saleId}
         join ${batches} on ${batches.id} = ${saleItems.batchId}
        where ${sales.createdAt}::date = CURRENT_DATE) as todays_profit,

      -- Row sets come back as JSON. The ORDER BY sits inside json_agg so the array order is
      -- guaranteed rather than incidental to how the planner happened to return the subquery.
      (select coalesce(json_agg(row_to_json(t) order by t."totalQty" desc), '[]'::json) from (
         select ${saleItems.medicineId} as "medicineId",
                ${medicines.name} as name,
                sum(${saleItems.quantity})::int as "totalQty"
           from ${saleItems}
           join ${sales} on ${sales.id} = ${saleItems.saleId}
           join ${medicines} on ${medicines.id} = ${saleItems.medicineId}
          where ${sales.createdAt}::date >= CURRENT_DATE - 30
          group by ${saleItems.medicineId}, ${medicines.name}
          order by sum(${saleItems.quantity}) desc
          limit 5
       ) t) as top_selling,

      (select coalesce(json_agg(row_to_json(t) order by t.month), '[]'::json) from (
         select to_char(${sales.createdAt}::date, 'YYYY-MM') as month,
                sum(${sales.total}) as total
           from ${sales}
          where ${sales.createdAt}::date >= (CURRENT_DATE - INTERVAL '6 months')::date
          group by to_char(${sales.createdAt}::date, 'YYYY-MM')
       ) t) as monthly_sales,

      (select coalesce(json_agg(row_to_json(t) order by t.month), '[]'::json) from (
         select to_char(${purchases.createdAt}::date, 'YYYY-MM') as month,
                sum(${purchases.invoiceTotal}) as total
           from ${purchases}
          where ${purchases.createdAt}::date >= (CURRENT_DATE - INTERVAL '6 months')::date
          group by to_char(${purchases.createdAt}::date, 'YYYY-MM')
       ) t) as monthly_purchases,

      (select coalesce(json_agg(row_to_json(t) order by t.month), '[]'::json) from (
         select to_char(${sales.createdAt}::date, 'YYYY-MM') as month,
                sum((${saleItems.salePrice} - ${batches.purchasePrice}) * ${saleItems.quantity}) as profit
           from ${saleItems}
           join ${sales} on ${sales.id} = ${saleItems.saleId}
           join ${batches} on ${batches.id} = ${saleItems.batchId}
          where ${sales.createdAt}::date >= (CURRENT_DATE - INTERVAL '6 months')::date
          group by to_char(${sales.createdAt}::date, 'YYYY-MM')
       ) t) as monthly_profit
  `);

  // drizzle's node-postgres driver returns the pg QueryResult; some versions return the rows
  // array directly. Handle both rather than depending on the driver's shape.
  const rows =
    (result as unknown as { rows?: DashboardRow[] }).rows ?? (result as unknown as DashboardRow[]);
  const row = rows[0];

  return {
    todaysSales: { total: row.todays_sales_total, count: row.todays_sales_count },
    todaysPurchases: { total: row.todays_purchases_total, count: row.todays_purchases_count },
    stockValue: row.stock_value,
    lowStockCount: row.low_stock_count,
    outOfStockCount: row.out_of_stock_count,
    expiringCount: row.expiring_count,
    pendingPayments: row.pending_payments,
    todaysProfit: row.todays_profit,
    topSelling: row.top_selling,
    monthlySales: row.monthly_sales,
    monthlyPurchases: row.monthly_purchases,
    monthlyProfit: row.monthly_profit,
  };
}
