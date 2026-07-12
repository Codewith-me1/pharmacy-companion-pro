import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, sql, like } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { purchases, purchaseItems, medicines, batches, suppliers, stockMovements } from "../db/schema";
import { getServerConfig } from "../config.server";

const extractedItemSchema = z.object({
  medicineName: z.string(),
  pack: z.string().nullable().optional(),
  batchNumber: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(), // YYYY-MM
  manufactureDate: z.string().nullable().optional(),
  hsnCode: z.string().nullable().optional(),
  mrp: z.number().nullable().optional(),
  ptr: z.number().nullable().optional(),
  pts: z.number().nullable().optional(),
  purchasePrice: z.number().nullable().optional(),
  sellingPrice: z.number().nullable().optional(),
  gstPercent: z.number().nullable().optional(),
  cgst: z.number().nullable().optional(),
  sgst: z.number().nullable().optional(),
  igst: z.number().nullable().optional(),
  discount: z.number().nullable().optional(),
  scheme: z.string().nullable().optional(),
  freeQuantity: z.number().nullable().optional(),
  quantity: z.number().nullable().optional(),
  confidence: z.number().min(0).max(1).default(0.6),
});

const extractedInvoiceSchema = z.object({
  supplierName: z.string().nullable().optional(),
  supplierGstNumber: z.string().nullable().optional(),
  supplierDlNo: z.string().nullable().optional(),
  supplierAddress: z.string().nullable().optional(),
  invoiceNumber: z.string().nullable().optional(),
  serialNumber: z.string().nullable().optional(),
  invoiceDate: z.string().nullable().optional(),
  billNumber: z.string().nullable().optional(),
  invoiceTotal: z.number().nullable().optional(),
  netAmount: z.number().nullable().optional(),
  taxAmount: z.number().nullable().optional(),
  items: z.array(extractedItemSchema),
});

const STANDARD_GST_SLABS = [0, 5, 12, 18, 28];

const JSON_SHAPE_HINT = JSON.stringify({
  supplierName: "string|null",
  supplierGstNumber: "string|null",
  supplierDlNo: "string|null (the SUPPLIER's own Drug License number printed on the invoice, not yours)",
  supplierAddress: "string|null",
  invoiceNumber: "string|null",
  serialNumber: "string|null (the invoice's own serial/reference number, if printed separately from the invoice number)",
  invoiceDate: "string|null",
  billNumber: "string|null",
  invoiceTotal: "number|null",
  netAmount: "number|null",
  taxAmount: "number|null",
  items: [
    {
      medicineName: "string",
      pack: "string|null (pack size as printed, e.g. '10s', '200ML', '20G', '1X10')",
      batchNumber: "string|null",
      expiryDate: "string|null",
      manufactureDate: "string|null",
      hsnCode: "string|null",
      mrp: "number|null",
      ptr: "number|null",
      pts: "number|null",
      purchasePrice: "number|null",
      sellingPrice: "number|null",
      gstPercent: "number|null",
      cgst: "number|null",
      sgst: "number|null",
      igst: "number|null",
      discount: "number|null",
      scheme: "string|null",
      freeQuantity: "number|null",
      quantity: "number|null",
      confidence: "number (0-1)",
    },
  ],
});

function normalizeExpiry(raw: string | null | undefined): string | null {
  if (!raw) return null;
  // Accept MM/YYYY, MM-YYYY, YYYY-MM, or full dates; normalize to YYYY-MM-DD (end of month for month-only).
  const trimmed = raw.trim();
  const mmYyyy = trimmed.match(/^(\d{1,2})[/-](\d{4})$/);
  if (mmYyyy) {
    const month = Number(mmYyyy[1]);
    const year = Number(mmYyyy[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  const yyyyMm = trimmed.match(/^(\d{4})[/-](\d{1,2})$/);
  if (yyyyMm) {
    const year = Number(yyyyMm[1]);
    const month = Number(yyyyMm[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

async function buildDraftFromExtraction(extracted: z.infer<typeof extractedInvoiceSchema>) {
  const db = getDb();

  let matchedSupplier: typeof suppliers.$inferSelect | undefined;
  if (extracted.supplierName) {
    const found = await db
      .select()
      .from(suppliers)
      .where(like(suppliers.name, `%${extracted.supplierName}%`))
      .limit(1);
    matchedSupplier = found[0];
  }

  const items = await Promise.all(
    extracted.items.map(async (item) => {
      const flags: string[] = [];
      const expiryDate = normalizeExpiry(item.expiryDate);

      if (expiryDate) {
        const daysToExpiry = (new Date(expiryDate).getTime() - Date.now()) / 86_400_000;
        if (daysToExpiry < 0) flags.push("wrong_expiry");
      } else {
        flags.push("wrong_expiry");
      }

      const existingMedicine = (
        await db.select().from(medicines).where(like(medicines.name, item.medicineName)).limit(1)
      )[0];

      if (existingMedicine) {
        if (item.gstPercent != null && Math.abs(existingMedicine.gstPercent - item.gstPercent) > 0.01) {
          flags.push("gst_mismatch");
        }
        if (
          item.purchasePrice != null &&
          existingMedicine.purchasePrice > 0 &&
          Math.abs(item.purchasePrice - existingMedicine.purchasePrice) / existingMedicine.purchasePrice > 0.05
        ) {
          flags.push("price_change");
        }

        if (item.batchNumber) {
          const existingBatch = (
            await db
              .select()
              .from(batches)
              .where(sql`${batches.medicineId} = ${existingMedicine.id} and ${batches.batchNo} = ${item.batchNumber}`)
              .limit(1)
          )[0];
          if (existingBatch) flags.push("existing_batch");
        }
      }

      if (item.gstPercent != null && !STANDARD_GST_SLABS.includes(Math.round(item.gstPercent))) {
        flags.push("gst_mismatch");
      }
      if (!item.quantity || item.quantity <= 0) flags.push("quantity_mismatch");

      const seenBatches = new Set<string>();
      const key = `${item.medicineName.toLowerCase()}|${item.batchNumber ?? ""}`;
      if (seenBatches.has(key)) flags.push("duplicate_batch");
      seenBatches.add(key);

      return {
        medicineId: existingMedicine?.id ?? null,
        medicineNameRaw: item.medicineName,
        pack: item.pack ?? existingMedicine?.pack ?? null,
        batchNo: item.batchNumber ?? null,
        expiryDate,
        manufactureDate: normalizeExpiry(item.manufactureDate),
        hsnCode: item.hsnCode ?? existingMedicine?.hsnCode ?? null,
        mrp: item.mrp ?? existingMedicine?.mrp ?? 0,
        ptr: item.ptr ?? 0,
        pts: item.pts ?? 0,
        purchasePrice: item.purchasePrice ?? existingMedicine?.purchasePrice ?? 0,
        sellingPrice: item.sellingPrice ?? existingMedicine?.sellingPrice ?? item.mrp ?? 0,
        gstPercent: item.gstPercent ?? existingMedicine?.gstPercent ?? 12,
        cgst: item.cgst ?? 0,
        sgst: item.sgst ?? 0,
        igst: item.igst ?? 0,
        discount: item.discount ?? 0,
        scheme: item.scheme ?? null,
        freeQty: item.freeQuantity ?? 0,
        quantity: item.quantity ?? 0,
        confidence: item.confidence,
        flags,
      };
    }),
  );

  return {
    supplier: {
      id: matchedSupplier?.id ?? null,
      name: extracted.supplierName ?? matchedSupplier?.name ?? "",
      gstNumber: extracted.supplierGstNumber ?? matchedSupplier?.gstNumber ?? "",
      dlNo: extracted.supplierDlNo ?? matchedSupplier?.dlNo ?? "",
      address: extracted.supplierAddress ?? matchedSupplier?.address ?? "",
    },
    invoiceNumber: extracted.invoiceNumber ?? "",
    serialNumber: extracted.serialNumber ?? "",
    invoiceDate: extracted.invoiceDate ?? "",
    billNumber: extracted.billNumber ?? "",
    invoiceTotal: extracted.invoiceTotal ?? 0,
    netAmount: extracted.netAmount ?? 0,
    taxAmount: extracted.taxAmount ?? 0,
    items,
    overallConfidence:
      items.length === 0 ? 0 : items.reduce((sum, i) => sum + i.confidence, 0) / items.length,
  };
}

export const extractInvoice = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      imageBase64: z.string(),
      mimeType: z.string().default("image/jpeg"),
      sourceLabel: z.enum(["camera", "webcam", "pdf", "scanner", "email"]).default("camera"),
    }),
  )
  .handler(async ({ data }) => {
    const config = getServerConfig();
    if (!config.openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured. Add it to your .env file to enable AI invoice extraction.",
      );
    }

    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    const response = await client.chat.completions.create({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      temperature: 0,
      max_tokens: 8000,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are an expert pharmacist's assistant specializing in reading Indian pharmaceutical purchase invoices, including ones that are blurry, skewed, low-light, partially cropped, or photographed at an angle.",
            "Work like a meticulous human transcriber: zoom into each row mentally, use surrounding context (column headers, repeated patterns, typical Indian pharma invoice conventions) to resolve ambiguous characters (e.g. 0 vs O, 1 vs I, 5 vs S), and never skip a row just because part of it is hard to read.",
            "Extract EVERY line item in the goods table, top to bottom, even if there are 20+ rows — do not truncate or summarize.",
            "Extract structured data as JSON matching this shape exactly:",
            JSON_SHAPE_HINT,
            "confidence is your 0-1 certainty for that line item's OCR accuracy overall (lower it for blurry/ambiguous rows instead of dropping them).",
            "Only use null when a field is truly absent from the invoice or fully illegible — for partially legible values, give your best reading at a lower confidence rather than nulling it out.",
            "Expiry/manufacture dates are usually MM/YYYY. GST is usually split as CGST+SGST (intra-state) or IGST (inter-state) — infer the total gstPercent from whichever is present.",
          ].join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract every field and every line item from this purchase invoice as accurately as possible, including if the photo quality is imperfect.",
            },
            {
              type: "image_url",
              image_url: { url: `data:${data.mimeType};base64,${data.imageBase64}`, detail: "high" },
            },
          ],
        },
      ],
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = extractedInvoiceSchema.parse(JSON.parse(raw));
    const draft = await buildDraftFromExtraction(parsed);
    return { draft, sourceLabel: data.sourceLabel };
  });

const draftItemInput = z.object({
  medicineId: z.number().nullable(),
  medicineNameRaw: z.string(),
  pack: z.string().nullable().optional(),
  batchNo: z.string().nullable(),
  expiryDate: z.string().nullable(),
  manufactureDate: z.string().nullable(),
  hsnCode: z.string().nullable(),
  mrp: z.number(),
  ptr: z.number().nullable().optional(),
  pts: z.number().nullable().optional(),
  purchasePrice: z.number(),
  sellingPrice: z.number().nullable().optional(),
  gstPercent: z.number(),
  cgst: z.number().nullable().optional(),
  sgst: z.number().nullable().optional(),
  igst: z.number().nullable().optional(),
  discount: z.number().nullable().optional(),
  scheme: z.string().nullable().optional(),
  freeQty: z.number().nullable().optional(),
  quantity: z.number(),
  confidence: z.number().optional(),
  flags: z.array(z.string()).optional(),
});

export const savePurchase = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      supplier: z.object({
        id: z.number().nullable(),
        name: z.string(),
        gstNumber: z.string(),
        dlNo: z.string().optional(),
        address: z.string(),
      }),
      invoiceNumber: z.string().optional(),
      serialNumber: z.string().optional(),
      invoiceDate: z.string().optional(),
      billNumber: z.string().optional(),
      invoiceTotal: z.number().optional(),
      netAmount: z.number().optional(),
      taxAmount: z.number().optional(),
      sourceLabel: z.string().optional(),
      overallConfidence: z.number().optional(),
      items: z.array(draftItemInput),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();

    let supplierId = data.supplier.id;
    if (!supplierId && data.supplier.name) {
      const inserted = await db
        .insert(suppliers)
        .values({
          name: data.supplier.name,
          gstNumber: data.supplier.gstNumber,
          dlNo: data.supplier.dlNo,
          address: data.supplier.address,
        })
        .returning();
      supplierId = inserted[0].id;
    } else if (supplierId && data.supplier.dlNo) {
      const [existingSupplier] = await db.select().from(suppliers).where(eq(suppliers.id, supplierId));
      if (existingSupplier && !existingSupplier.dlNo) {
        await db.update(suppliers).set({ dlNo: data.supplier.dlNo }).where(eq(suppliers.id, supplierId));
      }
    }

    const [purchase] = await db
      .insert(purchases)
      .values({
        supplierId,
        invoiceNumber: data.invoiceNumber,
        serialNumber: data.serialNumber,
        invoiceDate: data.invoiceDate,
        billNumber: data.billNumber,
        invoiceTotal: data.invoiceTotal ?? 0,
        netAmount: data.netAmount ?? 0,
        taxAmount: data.taxAmount ?? 0,
        status: "verified",
        ocrConfidence: data.overallConfidence,
        sourceLabel: data.sourceLabel,
      })
      .returning();

    for (const item of data.items) {
      let medicineId = item.medicineId;
      if (!medicineId) {
        const inserted = await db
          .insert(medicines)
          .values({
            name: item.medicineNameRaw,
            pack: item.pack ?? undefined,
            mrp: item.mrp,
            sellingPrice: item.sellingPrice ?? item.mrp,
            purchasePrice: item.purchasePrice,
            gstPercent: item.gstPercent,
            hsnCode: item.hsnCode ?? undefined,
          })
          .returning();
        medicineId = inserted[0].id;
      }

      await db.insert(purchaseItems).values({
        purchaseId: purchase.id,
        medicineId,
        medicineNameRaw: item.medicineNameRaw,
        pack: item.pack,
        batchNo: item.batchNo,
        expiryDate: item.expiryDate,
        manufactureDate: item.manufactureDate,
        hsnCode: item.hsnCode,
        mrp: item.mrp,
        ptr: item.ptr,
        pts: item.pts,
        purchasePrice: item.purchasePrice,
        sellingPrice: item.sellingPrice,
        gstPercent: item.gstPercent,
        cgst: item.cgst,
        sgst: item.sgst,
        igst: item.igst,
        discount: item.discount,
        scheme: item.scheme,
        freeQty: item.freeQty,
        quantity: item.quantity,
        confidence: item.confidence,
        flags: JSON.stringify(item.flags ?? []),
      });

      if (item.batchNo && item.expiryDate) {
        const [batch] = await db
          .insert(batches)
          .values({
            medicineId,
            batchNo: item.batchNo,
            expiryDate: item.expiryDate,
            manufactureDate: item.manufactureDate ?? undefined,
            quantity: item.quantity + (item.freeQty ?? 0),
            purchasePrice: item.purchasePrice,
            mrp: item.mrp,
            ptr: item.ptr ?? 0,
            pts: item.pts ?? 0,
            supplierId,
            purchaseId: purchase.id,
          })
          .returning();

        await db.insert(stockMovements).values({
          medicineId,
          batchId: batch.id,
          type: "in",
          quantity: item.quantity + (item.freeQty ?? 0),
          reason: "Purchase entry",
          referenceType: "purchase",
          referenceId: purchase.id,
        });
      }
    }

    return { purchaseId: purchase.id };
  });

export const listPurchases = createServerFn({ method: "GET" }).handler(async () => {
  const db = getDb();
  const rows = await db
    .select({
      id: purchases.id,
      invoiceNumber: purchases.invoiceNumber,
      invoiceDate: purchases.invoiceDate,
      billNumber: purchases.billNumber,
      invoiceTotal: purchases.invoiceTotal,
      status: purchases.status,
      ocrConfidence: purchases.ocrConfidence,
      createdAt: purchases.createdAt,
      supplierName: suppliers.name,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .orderBy(desc(purchases.createdAt));
  return rows;
});

export const getPurchase = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const db = getDb();
    const [purchase] = await db.select().from(purchases).where(eq(purchases.id, data.id));
    const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, data.id));
    return { purchase, items: items.map((i) => ({ ...i, flags: JSON.parse(i.flags ?? "[]") })) };
  });
