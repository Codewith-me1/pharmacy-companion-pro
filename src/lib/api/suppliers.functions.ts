import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { suppliers, purchases } from "../db/schema";

export const listSuppliers = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  return db.select().from(suppliers).orderBy(suppliers.name);
});

export const getSupplier = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [supplier] = await db.select().from(suppliers).where(eq(suppliers.id, data.id));
    const purchaseHistory = await db
      .select()
      .from(purchases)
      .where(eq(purchases.supplierId, data.id))
      .orderBy(desc(purchases.createdAt));
    return { supplier, purchaseHistory };
  });

export const upsertSupplier = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      gstNumber: z.string().optional(),
      address: z.string().optional(),
      phone: z.string().optional(),
      creditDays: z.number().default(0),
      outstanding: z.number().default(0),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    if (data.id) {
      await db.update(suppliers).set(data).where(eq(suppliers.id, data.id));
      return { id: data.id };
    }
    const [inserted] = await db.insert(suppliers).values(data).returning();
    return { id: inserted.id };
  });

export const deleteSupplier = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
    await db.delete(suppliers).where(eq(suppliers.id, data.id));
    return { ok: true };
  });
