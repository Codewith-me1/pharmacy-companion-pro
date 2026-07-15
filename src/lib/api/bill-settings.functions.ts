import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { billSettings } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

const customFieldSchema = z.object({ label: z.string(), value: z.string() });

const DEFAULT_TERMS = [
  "Goods once sold will not be taken back or exchanged.",
  "All disputes are subject to local jurisdiction only.",
  "Please retain this bill for any exchange or warranty claims.",
].join("\n");

function parseCustomFields(json: string | null) {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export const getBillSettings = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    const [row] = await db.select().from(billSettings).limit(1);
    if (!row) {
      return {
        showDoctor: true,
        showCustomerAddress: false,
        showBatchNo: true,
        showExpiry: true,
        showMrp: true,
        showDiscountPercent: true,
        footerNote: "",
        termsText: DEFAULT_TERMS,
        customFields: [] as { label: string; value: string }[],
      };
    }
    return {
      showDoctor: row.showDoctor,
      showCustomerAddress: row.showCustomerAddress,
      showBatchNo: row.showBatchNo,
      showExpiry: row.showExpiry,
      showMrp: row.showMrp,
      showDiscountPercent: row.showDiscountPercent,
      footerNote: row.footerNote ?? "",
      termsText: row.termsText ?? DEFAULT_TERMS,
      customFields: parseCustomFields(row.customFieldsJson),
    };
  });
});

export const saveBillSettings = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      showDoctor: z.boolean(),
      showCustomerAddress: z.boolean(),
      showBatchNo: z.boolean(),
      showExpiry: z.boolean(),
      showMrp: z.boolean(),
      showDiscountPercent: z.boolean(),
      footerNote: z.string().optional(),
      termsText: z.string().optional(),
      customFields: z.array(customFieldSchema).default([]),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const { customFields, ...rest } = data;
      const values = { ...rest, customFieldsJson: JSON.stringify(customFields) };
      const [existing] = await db.select().from(billSettings).limit(1);
      if (existing) {
        await db.update(billSettings).set(values).where(eq(billSettings.id, existing.id));
        return { id: existing.id };
      }
      const [inserted] = await db.insert(billSettings).values(values).returning();
      return { id: inserted.id };
    });
  });
