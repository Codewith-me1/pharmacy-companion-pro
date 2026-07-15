import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { businessSettings } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const getBusinessSettings = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    const [row] = await db.select().from(businessSettings).limit(1);
    return row ?? null;
  });
});

export const saveBusinessSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      firmName: z.string().optional(),
      dlNo: z.string().optional(),
      gstNumber: z.string().optional(),
      mobile: z.string().optional(),
      address: z.string().optional(),
      aiAssistantEnabled: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [existing] = await db.select().from(businessSettings).limit(1);
      if (existing) {
        await db.update(businessSettings).set(data).where(eq(businessSettings.id, existing.id));
        return { id: existing.id };
      }
      const [inserted] = await db.insert(businessSettings).values(data).returning();
      return { id: inserted.id };
    });
  });
