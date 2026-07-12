import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, sql } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { sales, saleItems, batches, medicines, customers, doctors, stockMovements } from "../db/schema";

async function nextBillNumber(prefix: string) {
  const db = getDb();
  const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(sales);
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
    const db = getDb();

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

    const billNumber = await nextBillNumber(data.billType === "gst" ? "GST" : "BILL");

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

export const listSales = createServerFn({ method: "GET" })
  .inputValidator(z.object({ limit: z.number().default(100) }).optional())
  .handler(async ({ data }) => {
    const db = getDb();
    return db
      .select({
        id: sales.id,
        billNumber: sales.billNumber,
        billType: sales.billType,
        total: sales.total,
        paymentMode: sales.paymentMode,
        paymentStatus: sales.paymentStatus,
        createdAt: sales.createdAt,
        customerName: customers.name,
      })
      .from(sales)
      .leftJoin(customers, eq(customers.id, sales.customerId))
      .orderBy(desc(sales.createdAt))
      .limit(data?.limit ?? 100);
  });

export const getSale = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
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
