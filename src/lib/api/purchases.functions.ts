import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc, sql, ilike } from "drizzle-orm";
import { purchases, purchaseItems, medicines, batches, suppliers, stockMovements } from "../db/schema";
import { getServerConfig } from "../config.server";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";
import { analyzeInvoiceLayout } from "../azure-document-intelligence.server";
import type { getDb } from "../db/client.server";

// Every field is `.nullable()` rather than `.optional()`, and confidence has no `.default()` —
// OpenAI's Structured Outputs (strict JSON schema mode) requires every property to always be
// present in the output; "optional" isn't representable, only "present but possibly null". The
// model is forced to actually decide null vs. a value for each field instead of omitting it,
// which is itself an accuracy win on top of guaranteeing the JSON always matches this shape
// exactly — no more malformed/missing-field parse failures to fall back on defaults for.
const extractedItemSchema = z.object({
  medicineName: z.string().describe("Product/brand name as printed, without dosage strength baked in unless it's part of the brand name. Some invoices only have one 'Particulars'/'Description' column, with pack size and/or batch/expiry printed as extra lines stacked directly below the name inside that same cell — pull those into pack/batchNumber/expiryDate below rather than leaving them stuck in this field."),
  pack: z.string().nullable().describe("Pack size as printed, e.g. '10s', '200ML', '20G', '1X10'. If there's no dedicated Pack column, look for a pack-size-shaped token (NxN, a number followed by ML/G/S/TAB) stacked under the medicine name in its own cell/line."),
  batchNumber: z.string().nullable().describe("Batch/lot number as printed, alphanumeric."),
  expiryDate: z.string().nullable().describe("Expiry date as printed. Usually MM/YYYY, but very often a 2-digit-year short form like '08/27' (meaning August 2027, NOT day 27) — report exactly what's printed either way, don't expand the year yourself. If there's no dedicated Expiry column, look for a date-shaped token stacked under the medicine name in its own cell/line."),
  manufactureDate: z.string().nullable().describe("Manufacture date as printed, usually MM/YYYY or the 2-digit-year form MM/YY."),
  hsnCode: z.string().nullable().describe("HSN code, typically 4-8 digits."),
  mrp: z.number().nullable().describe("Maximum Retail Price per unit."),
  ptr: z.number().nullable().describe("Price to Retailer per unit, if printed as a separate column from purchase price."),
  pts: z.number().nullable().describe("Price to Stockist per unit, if printed."),
  purchasePrice: z.number().nullable().describe("The actual per-unit rate this pharmacy is being charged (often labelled Rate/Cost)."),
  sellingPrice: z.number().nullable().describe("Suggested selling price, only if explicitly printed — do not compute this yourself."),
  gstPercent: z.number().nullable().describe("Total GST rate for this line, e.g. 12 or 18. If only CGST+SGST or IGST are printed, sum/report the combined rate here."),
  cgst: z.number().nullable().describe("CGST amount or rate if printed separately (intra-state invoice)."),
  sgst: z.number().nullable().describe("SGST amount or rate if printed separately (intra-state invoice)."),
  igst: z.number().nullable().describe("IGST amount or rate if printed separately (inter-state invoice)."),
  discount: z.number().nullable().describe("Line-level discount percent or amount, if printed."),
  scheme: z.string().nullable().describe("Any promotional scheme text printed for this line, e.g. '10+1 free'."),
  freeQuantity: z.number().nullable().describe("Free/bonus quantity granted on this line, separate from the billed quantity. Often under a column header abbreviated 'F.Qty' or 'Free'."),
  quantity: z.number().nullable().describe("Billed quantity for this line (not including any free quantity). The column header is very often abbreviated to 'Qty', 'Bill Qty', or 'Q.ty' rather than spelled out."),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Your own 0-1 certainty that THIS SPECIFIC ROW was read correctly overall. 0.9+ only for a fully legible, unambiguous row. Below 0.5 for rows with multiple illegible or guessed characters. Never skip a row for low confidence — report your best reading and lower this instead.",
    ),
});

const extractedInvoiceSchema = z.object({
  supplierName: z.string().nullable().describe("The selling party's (supplier's) business name."),
  supplierGstNumber: z.string().nullable().describe("The SUPPLIER's own GSTIN printed on the invoice."),
  supplierDlNo: z.string().nullable().describe("The SUPPLIER's own Drug License number printed on the invoice — never the buyer's/pharmacy's own DL number."),
  supplierAddress: z.string().nullable().describe("The supplier's printed address."),
  invoiceNumber: z.string().nullable().describe("The invoice/bill number."),
  serialNumber: z.string().nullable().describe("A separate serial/reference number, only if printed distinctly from the invoice number."),
  invoiceDate: z.string().nullable().describe("The invoice date as printed."),
  billNumber: z.string().nullable().describe("An alternate bill number field, only if the invoice prints a bill number distinct from the invoice number."),
  invoiceTotal: z.number().nullable().describe("The final grand total of the invoice, after tax."),
  netAmount: z.number().nullable().describe("The net/taxable amount before tax, if printed as a separate subtotal."),
  taxAmount: z.number().nullable().describe("The total tax amount for the whole invoice, if printed as a single figure."),
  items: z.array(extractedItemSchema).describe("Every line item in the goods table, in the same top-to-bottom order as printed. Never truncate, summarize, or merge rows — one entry per printed row, even for 20+ rows."),
});

const STANDARD_GST_SLABS = [0, 5, 12, 18, 28];

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
  // 2-digit-year short form, e.g. "08/27" meaning August 2027 — very common on Indian pharma
  // invoices. Handled before the generic Date fallback below, because `new Date("08/27")` would
  // otherwise misparse this as day 27 of the CURRENT year rather than a month/year expiry.
  const mmYy = trimmed.match(/^(\d{1,2})[/-](\d{2})$/);
  if (mmYy) {
    const month = Number(mmYy[1]);
    const year = 2000 + Number(mmYy[2]);
    const lastDay = new Date(year, month, 0).getDate();
    return `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }
  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}

async function buildDraftFromExtraction(db: ReturnType<typeof getDb>, extracted: z.infer<typeof extractedInvoiceSchema>) {
  let matchedSupplier: typeof suppliers.$inferSelect | undefined;
  if (extracted.supplierName) {
    const found = await db
      .select()
      .from(suppliers)
      .where(ilike(suppliers.name, `%${extracted.supplierName}%`))
      .limit(1);
    matchedSupplier = found[0];
  }

  // Shared across all items — must live outside the map callback, otherwise each item would
  // check against its own fresh empty set and duplicate_batch could never actually fire.
  const seenBatches = new Set<string>();

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
        await db.select().from(medicines).where(ilike(medicines.name, item.medicineName)).limit(1)
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

  flagSuspiciousDuplicateRows(items);

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

// Defensive check independent of model behavior: dense multi-row invoices are a known failure
// mode where a model "anchors" on the first row it reads clearly and reuses its batch/price/HSN
// for later rows instead of re-reading each row from the image. If 2+ DIFFERENT medicines end up
// with an identical batch+MRP+purchase-price+HSN combination, that's almost certainly this bug,
// not a real coincidence — flag every row in the cluster and force low confidence so the
// pharmacist re-checks them against the photo before saving, regardless of how it happened.
// Exported standalone (not inlined) so it's unit-testable without a DB or OpenAI call.
export function flagSuspiciousDuplicateRows(
  items: { medicineNameRaw: string; batchNo: string | null; mrp: number; purchasePrice: number; hsnCode: string | null; flags: string[]; confidence: number }[],
): void {
  const valueClusters = new Map<string, number[]>();
  items.forEach((item, idx) => {
    if (!item.batchNo) return;
    const clusterKey = `${item.batchNo.toLowerCase()}|${item.mrp}|${item.purchasePrice}|${item.hsnCode ?? ""}`;
    const indices = valueClusters.get(clusterKey) ?? [];
    indices.push(idx);
    valueClusters.set(clusterKey, indices);
  });
  for (const indices of valueClusters.values()) {
    if (indices.length < 2) continue;
    const distinctNames = new Set(indices.map((idx) => items[idx].medicineNameRaw.trim().toLowerCase()));
    if (distinctNames.size < 2) continue; // genuinely the same medicine repeated — not the bug this guards against
    for (const idx of indices) {
      items[idx].flags.push("possible_duplicate_data");
      items[idx].confidence = Math.min(items[idx].confidence, 0.3);
    }
  }
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
    const userId = await requireUserId();
    const config = getServerConfig();
    if (!config.openaiApiKey) {
      throw new Error(
        "OPENAI_API_KEY is not configured. Add it to your .env file to enable AI invoice extraction.",
      );
    }
    if (!config.azureDocIntelEndpoint || !config.azureDocIntelKey) {
      throw new Error(
        "Azure Document Intelligence is not configured. Add AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT and AZURE_DOCUMENT_INTELLIGENCE_KEY to your .env file to enable AI invoice extraction.",
      );
    }

    // Pipeline: Bill Image -> Azure Document Intelligence (Layout) -> OCR text + table grid ->
    // ChatGPT -> structured JSON. Azure's layout model is a specialist OCR+table-structure
    // engine, so it pins every printed value to an exact row/column far more reliably than asking
    // a vision LLM to read the raw photo. That split — Azure does the pixel-reading, the LLM does
    // the semantic mapping onto our schema — is what buys the accuracy improvement over sending
    // the photo straight to the vision model.
    const layout = await analyzeInvoiceLayout(
      config.azureDocIntelEndpoint,
      config.azureDocIntelKey,
      Buffer.from(data.imageBase64, "base64"),
    );

    if (!layout.text || layout.text.replace(/[^a-zA-Z0-9]/g, "").length < 20) {
      throw new Error(
        "Azure Document Intelligence could not read any text from this photo. Try a clearer, better-lit photo.",
      );
    }

    const { default: OpenAI } = await import("openai");
    const { zodResponseFormat } = await import("openai/helpers/zod");
    const client = new OpenAI({ apiKey: config.openaiApiKey });

    // Structured Outputs (response_format below) guarantees the JSON always matches
    // extractedInvoiceSchema exactly (every field present, correct types) — a real accuracy floor
    // independent of model size, so it's kept regardless of which model reads the OCR text.
    const response = await client.chat.completions.parse({
      model: process.env.OPENAI_EXTRACTION_MODEL || process.env.OPENAI_VISION_MODEL || "gpt-4o",
      temperature: 0,
      max_tokens: 12_000,
      response_format: zodResponseFormat(extractedInvoiceSchema, "invoice_extraction"),
      messages: [
        {
          role: "system",
          content: [
            "You are an expert pharmacist's assistant that converts OCR-extracted text and table structure from an Indian pharmaceutical purchase invoice into structured data. You are NOT looking at the original photo — you are given Azure Document Intelligence's OCR output: the full document text in reading order, plus an explicit row/column grid for every table it detected on the page.",
            "",
            "Your job has two parts:",
            "1. Understand the invoice: find which table is the goods/line-items table, and map its columns to the schema fields (figure out which column is Rate vs MRP vs PTR vs PTS, Free Qty vs Billed Qty, etc. from the header row and typical Indian pharma invoice conventions — column order varies between suppliers).",
            "2. Correct for OCR noise: Azure's OCR is very accurate but not perfect. Resolve likely misreads using context — a numeric column showing a stray letter almost certainly meant the visually similar digit (O->0, S->5, I or l->1, B->8, G->6, Z->2); pick whichever reading is consistent with the column being numeric vs alphabetic and with what's typical for that field (HSN codes are 4-8 digits, GST is one of 0/5/12/18/28).",
            "",
            "CRITICAL — use the table grid as the source of truth, not just the free text above it: every row in the '=== DETECTED TABLE STRUCTURE ===' grid has its OWN batch number, MRP, rate, HSN and expiry, even when several rows are the same brand family or look like similar products (e.g. the same item in different pack sizes). Read each row's values from that row's own grid cells only — never carry over or default to a neighboring row's values just because the product name looks similar. If two DIFFERENT medicine rows end up with an identical batch+MRP+rate+HSN combination, that almost always means a value got assigned to the wrong row — re-check both rows against the grid before finalizing either one.",
            "",
            "Real layout quirks to watch for — do not let these cause null/wrong fields:",
            "- Column headers are very often abbreviated: 'Qty'/'Bill Qty'/'Q.ty' = billed quantity, 'F.Qty'/'Free' = free quantity, 'Exp'/'Exp.Dt'/'E.Date' = expiry, 'B.No'/'Bt.No' = batch number, 'P.Rate'/'Rate'/'Cost' = purchase price, 'Disc'/'Disc%' = discount. Map these the same as their full names.",
            "- Expiry (and manufacture) dates are often a 2-digit-year short form like '08/27' — that means August 2027, NOT day-27-of-something. Treat any MM/YY-shaped token in an expiry-ish column or position the same way you'd treat MM/YYYY; report it exactly as printed either way, don't expand the year yourself.",
            "- Some invoices have no separate Pack or Expiry column at all — only one 'Particulars'/'Description' column. On those, the pack size and/or batch+expiry are printed as extra lines stacked directly below the medicine name, inside that same cell (they'll show up as extra text right after the product name in the grid cell or in the full document text immediately below it). Actively look there for a pack-size-shaped token (e.g. '10X10', '100ML', '1X6', '30S') and a date-shaped token (MM/YY or MM/YYYY) whenever the dedicated pack/expiry columns are empty or missing, and use those instead of leaving the fields null.",
            "",
            "- Process every row of the goods table top to bottom, even if there are 20+ rows. Never skip, merge, truncate, or summarize rows.",
            "- Cross-check arithmetic where possible: if a row has quantity, rate and amount, amount should roughly equal quantity x rate — a clear mismatch means one of the three was likely misread; re-derive it from the grid before finalizing.",
            "- Only output null for a field when it is genuinely absent from both the OCR text and the table grid (including stacked lines under the medicine name) — if there's a partial or slightly garbled value anywhere, give your best corrected reading and lower that row's confidence instead of nulling it.",
            "- GST is usually printed as CGST+SGST (intra-state) or IGST (inter-state), as either a rate (%) or an amount. Report whichever is present in cgst/sgst/igst, and always fill gstPercent with the combined rate even if you have to sum CGST%+SGST%.",
            "- supplierDlNo and supplierGstNumber belong to the SELLER printed on the invoice letterhead, never the buyer's/pharmacy's own details even if both appear in the text.",
          ].join("\n"),
        },
        {
          role: "user",
          content: [
            "Extract every field and every line item from this purchase invoice's OCR output as accurately as possible.",
            "Work through the goods table grid row by row, using each row's own cells — do not reuse a previous row's values, and do not stop early.",
            "",
            layout.text,
          ].join("\n"),
        },
      ],
    });

    const message = response.choices[0]?.message;
    if (message?.refusal) {
      throw new Error(`The AI declined to extract this invoice: ${message.refusal}`);
    }
    const parsed = message?.parsed;
    if (!parsed) {
      throw new Error("The AI did not return any extracted data for this invoice. Try a clearer photo.");
    }
    const draft = await withTenant(userId, async (db) => buildDraftFromExtraction(db, parsed));
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
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
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
  });

export const listPurchases = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
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
});

export const getPurchase = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [purchase] = await db.select().from(purchases).where(eq(purchases.id, data.id));
      const items = await db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, data.id));
      return { purchase, items: items.map((i) => ({ ...i, flags: JSON.parse(i.flags ?? "[]") })) };
    });
  });
