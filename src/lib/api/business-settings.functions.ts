import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { businessSettings } from "../db/schema";

export const getBusinessSettings = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const [row] = await db.select().from(businessSettings).limit(1);
  return row ?? null;
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
    const db = getDb();
    const [existing] = await db.select().from(businessSettings).limit(1);
    if (existing) {
      await db.update(businessSettings).set(data).where(eq(businessSettings.id, existing.id));
      return { id: existing.id };
    }
    const [inserted] = await db.insert(businessSettings).values(data).returning();
    return { id: inserted.id };
  });
