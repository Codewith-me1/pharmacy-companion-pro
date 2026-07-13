import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ilike, or, desc } from "drizzle-orm";
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
        .where(or(ilike(medicines.name, term), ilike(medicines.company, term), ilike(medicines.barcode, term)))
        .limit(5),
      db
        .select({ id: suppliers.id, name: suppliers.name, outstanding: suppliers.outstanding })
        .from(suppliers)
        .where(ilike(suppliers.name, term))
        .limit(5),
      db
        .select({ id: doctors.id, name: doctors.name, specialization: doctors.specialization })
        .from(doctors)
        .where(ilike(doctors.name, term))
        .limit(5),
      db
        .select({ id: customers.id, name: customers.name, phone: customers.phone })
        .from(customers)
        .where(or(ilike(customers.name, term), ilike(customers.phone, term)))
        .limit(5),
      db
        .select({ id: purchases.id, invoiceNumber: purchases.invoiceNumber, billNumber: purchases.billNumber, invoiceTotal: purchases.invoiceTotal })
        .from(purchases)
        .where(or(ilike(purchases.invoiceNumber, term), ilike(purchases.billNumber, term)))
        .orderBy(desc(purchases.createdAt))
        .limit(5),
      db
        .select({ id: sales.id, billNumber: sales.billNumber, total: sales.total })
        .from(sales)
        .where(ilike(sales.billNumber, term))
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
