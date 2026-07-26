import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, asc, desc } from "drizzle-orm";
import { customers, sales } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const listCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => db.select().from(customers).orderBy(asc(customers.name)));
});

export const getCustomer = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [customer] = await db.select().from(customers).where(eq(customers.id, data.id));
      const purchaseHistory = await db
        .select()
        .from(sales)
        .where(eq(sales.customerId, data.id))
        .orderBy(desc(sales.createdAt));
      return { customer, purchaseHistory };
    });
  });

export const upsertCustomer = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      id: z.number().optional(),
      name: z.string().min(1),
      phone: z.string().optional(),
      address: z.string().optional(),
      gstNumber: z.string().optional(),
      creditBalance: z.number().default(0),
      loyaltyPoints: z.number().default(0),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      if (data.id) {
        await db.update(customers).set(data).where(eq(customers.id, data.id));
        return { id: data.id };
      }
      const [inserted] = await db.insert(customers).values(data).returning();
      return { id: inserted.id };
    });
  });

export const bulkImportCustomers = createServerFn({ method: "POST" })
  .inputValidator(z.object({ rows: z.array(z.record(z.string(), z.string())) }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      let created = 0;
      let skipped = 0;
      const errors: string[] = [];

      for (const [index, row] of data.rows.entries()) {
        const rowNumber = index + 2;
        const name = row.name?.trim();
        if (!name) {
          skipped++;
          errors.push(`Row ${rowNumber}: missing customer name — skipped.`);
          continue;
        }
        await db.insert(customers).values({
          name,
          phone: row.phone?.trim() || undefined,
          address: row.address?.trim() || undefined,
          gstNumber: row.gstNumber?.trim() || undefined,
        });
        created++;
      }

      return { created, skipped, errors };
    });
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      await db.delete(customers).where(eq(customers.id, data.id));
      return { ok: true };
    });
  });
