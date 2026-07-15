import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, sql, and, or, ilike } from "drizzle-orm";
import { sales, saleItems, batches, medicines, customers, doctors, stockMovements } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";
import type { getDb } from "../db/client.server";

async function nextBillNumber(db: ReturnType<typeof getDb>, prefix: string) {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(sales);
  return `${prefix}-${String(count + 1).padStart(5, "0")}`;
}

const saleItemInput = z.object({
  medicineId: z.number(),
  batchId: z.number(),
  quantity: z.number().int().min(1),
  mrp: z.number(),
  salePrice: z.number(),
  gstPercent: z.number(),
  discount: z.number().default(0),
});

export const createSale = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      customerId: z.number().nullable().optional(),
      doctorId: z.number().nullable().optional(),
      billType: z.enum(["retail", "gst", "wholesale", "estimate", "quotation", "credit"]).default("retail"),
      paymentMode: z.enum(["cash", "upi", "card", "credit", "split"]).default("cash"),
      discount: z.number().default(0),
      items: z.array(saleItemInput).min(1),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      for (const item of data.items) {
        const [batch] = await db.select().from(batches).where(eq(batches.id, item.batchId));
        if (!batch || batch.quantity < item.quantity) {
          throw new Error(`Insufficient stock for batch ${batch?.batchNo ?? item.batchId}`);
        }
      }

      const subtotal = data.items.reduce((sum, i) => sum + i.salePrice * i.quantity, 0);
      const gstAmount = data.items.reduce((sum, i) => sum + (i.salePrice * i.quantity * i.gstPercent) / 100, 0);
      const total = subtotal + gstAmount - data.discount;
      const isEstimateOrQuote = data.billType === "estimate" || data.billType === "quotation";
      const paymentStatus = data.billType === "credit" ? "pending" : "paid";

      const billNumber = await nextBillNumber(db, data.billType === "gst" ? "GST" : "BILL");

      const [sale] = await db
        .insert(sales)
        .values({
          customerId: data.customerId ?? null,
          doctorId: data.doctorId ?? null,
          billNumber,
          billType: data.billType,
          subtotal,
          discount: data.discount,
          gstAmount,
          total,
          paymentMode: data.paymentMode,
          paymentStatus,
        })
        .returning();

      for (const item of data.items) {
        await db.insert(saleItems).values({ saleId: sale.id, ...item });

        if (!isEstimateOrQuote) {
          const [batch] = await db.select().from(batches).where(eq(batches.id, item.batchId));
          await db.update(batches).set({ quantity: batch.quantity - item.quantity }).where(eq(batches.id, item.batchId));
          await db.insert(stockMovements).values({
            medicineId: item.medicineId,
            batchId: item.batchId,
            type: "out",
            quantity: item.quantity,
            reason: "Sale",
            referenceType: "sale",
            referenceId: sale.id,
          });
        }
      }

      if (data.billType === "credit" && data.customerId) {
        const [customer] = await db.select().from(customers).where(eq(customers.id, data.customerId));
        if (customer) {
          await db
            .update(customers)
            .set({ creditBalance: customer.creditBalance + total })
            .where(eq(customers.id, data.customerId));
        }
      }

      return { saleId: sale.id, billNumber, total };
    });
  });

const paymentModeFilter = z.enum(["cash", "upi", "card", "credit", "other"]).optional();

function paymentModeCondition(mode: z.infer<typeof paymentModeFilter>) {
  if (!mode) return undefined;
  // "other" covers anything that isn't one of the well-known modes (e.g. "split"), so the
  // filter chips stay exhaustive without needing a chip per obscure payment type.
  if (mode === "other") return sql`${sales.paymentMode} not in ('cash', 'upi', 'card', 'credit')`;
  return eq(sales.paymentMode, mode);
}

export const listSales = createServerFn({ method: "GET" })
  .inputValidator(
    z
      .object({
        limit: z.number().default(100),
        search: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        year: z.number().optional(),
        paymentMode: paymentModeFilter,
      })
      .optional(),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const search = data?.search?.trim();
      const conditions = [
        search
          ? or(ilike(sales.billNumber, `%${search}%`), ilike(customers.name, `%${search}%`), ilike(customers.phone, `%${search}%`))
          : undefined,
        data?.dateFrom ? sql`${sales.createdAt}::date >= ${data.dateFrom}::date` : undefined,
        data?.dateTo ? sql`${sales.createdAt}::date <= ${data.dateTo}::date` : undefined,
        data?.year ? sql`extract(year from ${sales.createdAt}::date) = ${data.year}` : undefined,
        paymentModeCondition(data?.paymentMode),
      ].filter(Boolean);

      return db
        .select({
          id: sales.id,
          billNumber: sales.billNumber,
          billType: sales.billType,
          discount: sales.discount,
          gstAmount: sales.gstAmount,
          total: sales.total,
          paymentMode: sales.paymentMode,
          paymentStatus: sales.paymentStatus,
          createdAt: sales.createdAt,
          customerName: customers.name,
          customerPhone: customers.phone,
        })
        .from(sales)
        .leftJoin(customers, eq(customers.id, sales.customerId))
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(sales.createdAt))
        .limit(data?.limit ?? 100);
    });
  });

export const getBillingStats = createServerFn({ method: "GET" })
  .inputValidator(z.object({ dateFrom: z.string().optional(), dateTo: z.string().optional() }).optional())
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const conditions = [
        data?.dateFrom ? sql`${sales.createdAt}::date >= ${data.dateFrom}::date` : undefined,
        data?.dateTo ? sql`${sales.createdAt}::date <= ${data.dateTo}::date` : undefined,
      ].filter(Boolean);
      const where = conditions.length ? and(...conditions) : undefined;

      const byMode = await db
        .select({ paymentMode: sales.paymentMode, total: sql<number>`coalesce(sum(${sales.total}), 0)`, count: sql<number>`count(*)::int` })
        .from(sales)
        .where(where)
        .groupBy(sales.paymentMode);

      const totalSales = byMode.reduce((sum, r) => sum + r.total, 0);
      const invoiceCount = byMode.reduce((sum, r) => sum + r.count, 0);
      const sumFor = (mode: string) => byMode.find((r) => r.paymentMode === mode)?.total ?? 0;
      const countFor = (mode: string) => byMode.find((r) => r.paymentMode === mode)?.count ?? 0;

      return {
        totalSales,
        invoiceCount,
        cashSales: sumFor("cash"),
        cashCount: countFor("cash"),
        upiSales: sumFor("upi"),
        upiCount: countFor("upi"),
        cardSales: sumFor("card"),
        cardCount: countFor("card"),
        creditSales: sumFor("credit"),
        creditCount: countFor("credit"),
      };
    });
  });

export const listSaleYears = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    const rows = await db
      .select({ year: sql<number>`extract(year from ${sales.createdAt}::date)::int` })
      .from(sales)
      .groupBy(sql`extract(year from ${sales.createdAt}::date)`)
      .orderBy(sql`extract(year from ${sales.createdAt}::date) desc`);
    return rows.map((r) => r.year);
  });
});

export const getSale = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [sale] = await db
        .select({
          id: sales.id,
          billNumber: sales.billNumber,
          billType: sales.billType,
          subtotal: sales.subtotal,
          discount: sales.discount,
          gstAmount: sales.gstAmount,
          total: sales.total,
          paymentMode: sales.paymentMode,
          paymentStatus: sales.paymentStatus,
          createdAt: sales.createdAt,
          customerName: customers.name,
          customerAddress: customers.address,
          doctorName: doctors.name,
        })
        .from(sales)
        .leftJoin(customers, eq(customers.id, sales.customerId))
        .leftJoin(doctors, eq(doctors.id, sales.doctorId))
        .where(eq(sales.id, data.id));
      const items = await db
        .select({
          id: saleItems.id,
          quantity: saleItems.quantity,
          mrp: saleItems.mrp,
          salePrice: saleItems.salePrice,
          gstPercent: saleItems.gstPercent,
          discount: saleItems.discount,
          medicineName: medicines.name,
          pack: medicines.pack,
          batchNo: batches.batchNo,
          expiryDate: batches.expiryDate,
        })
        .from(saleItems)
        .innerJoin(medicines, eq(medicines.id, saleItems.medicineId))
        .innerJoin(batches, eq(batches.id, saleItems.batchId))
        .where(eq(saleItems.saleId, data.id));
      return { sale, items };
    });
  });
