import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { like, or, desc } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { medicines, suppliers, doctors, customers, purchases, sales } from "../db/schema";

export const globalSearch = createServerFn({ method: "GET" })
  .inputValidator(z.object({ query: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const term = `%${data.query}%`;

    const [medicineRows, supplierRows, doctorRows, customerRows, purchaseRows, saleRows] = await Promise.all([
      db
        .select({ id: medicines.id, name: medicines.name, company: medicines.company, mrp: medicines.mrp })
        .from(medicines)
        .where(or(like(medicines.name, term), like(medicines.salt, term), like(medicines.company, term), like(medicines.barcode, term)))
        .limit(5),
      db
        .select({ id: suppliers.id, name: suppliers.name, outstanding: suppliers.outstanding })
        .from(suppliers)
        .where(like(suppliers.name, term))
        .limit(5),
      db
        .select({ id: doctors.id, name: doctors.name, specialization: doctors.specialization })
        .from(doctors)
        .where(like(doctors.name, term))
        .limit(5),
      db
        .select({ id: customers.id, name: customers.name, phone: customers.phone })
        .from(customers)
        .where(or(like(customers.name, term), like(customers.phone, term)))
        .limit(5),
      db
        .select({ id: purchases.id, invoiceNumber: purchases.invoiceNumber, billNumber: purchases.billNumber, invoiceTotal: purchases.invoiceTotal })
        .from(purchases)
        .where(or(like(purchases.invoiceNumber, term), like(purchases.billNumber, term)))
        .orderBy(desc(purchases.createdAt))
        .limit(5),
      db
        .select({ id: sales.id, billNumber: sales.billNumber, total: sales.total })
        .from(sales)
        .where(like(sales.billNumber, term))
        .orderBy(desc(sales.createdAt))
        .limit(5),
    ]);

    return {
      medicines: medicineRows,
      suppliers: supplierRows,
      doctors: doctorRows,
      customers: customerRows,
      purchases: purchaseRows,
      sales: saleRows,
    };
  });
