import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { billSettings } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

const customFieldSchema = z.object({ label: z.string(), value: z.string() });

const layoutSchema = z.object({
  plain: z.boolean(),
  hiddenColumns: z.array(z.enum(["sno", "description", "pack", "batch", "expiry", "qty", "rate", "mrp", "discount", "amount"])),
  hiddenSections: z.array(
    z.enum([
      "firmHeader",
      "licence",
      "phone",
      "copyLabel",
      "patient",
      "customerAddress",
      "doctor",
      "invoiceNo",
      "date",
      "footerNote",
      "terms",
      "customFields",
      "signature",
      "totalsBreakdown",
      "duplicateCopy",
    ]),
  ),
});

function parseLayout(json: string | null) {
  if (!json) return null;
  try {
    const parsed = layoutSchema.safeParse(JSON.parse(json));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

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
        layout: null as z.infer<typeof layoutSchema> | null,
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
      layout: parseLayout(row.layoutJson),
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
      layout: layoutSchema.nullable().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const { customFields, layout, ...rest } = data;
      const values = {
        ...rest,
        customFieldsJson: JSON.stringify(customFields),
        // Left unchanged when the caller doesn't send a layout at all.
        ...(layout !== undefined && { layoutJson: layout ? JSON.stringify(layout) : null }),
      };
      const [existing] = await db.select().from(billSettings).limit(1);
      if (existing) {
        await db.update(billSettings).set(values).where(eq(billSettings.id, existing.id));
        return { id: existing.id };
      }
      const [inserted] = await db.insert(billSettings).values(values).returning();
      return { id: inserted.id };
    });
  });
