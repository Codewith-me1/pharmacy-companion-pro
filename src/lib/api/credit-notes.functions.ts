import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, desc, eq, sql } from "drizzle-orm";
import { creditNotes, creditNoteApplications, purchases, suppliers } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

// ~5 MB of file once decoded. A credit note is a one-page photo or PDF; anything bigger is almost
// certainly the wrong file, and it would bloat every backup of the table.
const MAX_FILE_BASE64_LENGTH = 7_000_000;
const ALLOWED_MIME = /^(image\/(png|jpe?g|webp|heic|heif)|application\/pdf)$/;

// Every column except file_data, which is only ever fetched one note at a time to view it.
const noteColumns = {
  id: creditNotes.id,
  supplierId: creditNotes.supplierId,
  supplierName: suppliers.name,
  noteNumber: creditNotes.noteNumber,
  noteDate: creditNotes.noteDate,
  amount: creditNotes.amount,
  appliedAmount: creditNotes.appliedAmount,
  reason: creditNotes.reason,
  batchIdsJson: creditNotes.batchIdsJson,
  fileName: creditNotes.fileName,
  fileMimeType: creditNotes.fileMimeType,
  createdAt: creditNotes.createdAt,
};

function shape(row: {
  amount: number;
  appliedAmount: number;
  batchIdsJson: string | null;
  fileName: string | null;
}) {
  let batchIds: number[] = [];
  try {
    const parsed = JSON.parse(row.batchIdsJson ?? "[]");
    if (Array.isArray(parsed)) batchIds = parsed.filter((n): n is number => typeof n === "number");
  } catch {
    /* malformed JSON — treat as no linked batches */
  }
  return {
    remaining: Math.max(0, Math.round((row.amount - row.appliedAmount) * 100) / 100),
    batchIds,
    hasFile: !!row.fileName,
  };
}

export const listCreditNotes = createServerFn({ method: "GET" })
  .inputValidator(z.object({ supplierId: z.number().optional() }).optional())
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const rows = await db
        .select(noteColumns)
        .from(creditNotes)
        .innerJoin(suppliers, eq(suppliers.id, creditNotes.supplierId))
        .where(data?.supplierId ? eq(creditNotes.supplierId, data.supplierId) : undefined)
        .orderBy(desc(creditNotes.createdAt));

      const applications = await db
        .select({
          creditNoteId: creditNoteApplications.creditNoteId,
          purchaseId: creditNoteApplications.purchaseId,
          amount: creditNoteApplications.amount,
          invoiceNumber: purchases.invoiceNumber,
          invoiceDate: purchases.invoiceDate,
        })
        .from(creditNoteApplications)
        .innerJoin(purchases, eq(purchases.id, creditNoteApplications.purchaseId))
        .orderBy(creditNoteApplications.createdAt);

      return rows.map((r) => ({
        ...r,
        ...shape(r),
        applications: applications.filter((a) => a.creditNoteId === r.id),
      }));
    });
  });

// Open (not fully used) credit notes for the supplier on a purchase being entered. Resolved by id
// when the purchase is already linked to a supplier record, otherwise by exact (case-insensitive)
// name — the same lookup savePurchase uses — so a manually typed supplier name still finds them.
export const listOpenCreditNotes = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({ supplierId: z.number().nullable().optional(), supplierName: z.string().optional() }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      let supplierId = data.supplierId ?? null;
      if (!supplierId && data.supplierName?.trim()) {
        const [match] = await db
          .select({ id: suppliers.id })
          .from(suppliers)
          .where(sql`lower(trim(${suppliers.name})) = lower(trim(${data.supplierName}))`)
          .limit(1);
        supplierId = match?.id ?? null;
      }
      if (!supplierId) return { supplierId: null, notes: [] };

      const rows = await db
        .select(noteColumns)
        .from(creditNotes)
        .innerJoin(suppliers, eq(suppliers.id, creditNotes.supplierId))
        .where(
          and(
            eq(creditNotes.supplierId, supplierId),
            sql`${creditNotes.amount} - ${creditNotes.appliedAmount} > 0.005`,
          ),
        )
        // Oldest first: those are the ones the supplier expects to see settled first.
        .orderBy(creditNotes.createdAt);
      return { supplierId, notes: rows.map((r) => ({ ...r, ...shape(r) })) };
    });
  });

export const getCreditNoteFile = createServerFn({ method: "GET" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [row] = await db
        .select({
          fileName: creditNotes.fileName,
          fileMimeType: creditNotes.fileMimeType,
          fileData: creditNotes.fileData,
        })
        .from(creditNotes)
        .where(eq(creditNotes.id, data.id));
      if (!row?.fileData) throw new Error("No file is attached to this credit note.");
      return row;
    });
  });

export const createCreditNote = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      supplierId: z.number(),
      noteNumber: z.string().optional(),
      noteDate: z.string().optional(),
      amount: z.number().positive("Enter the credit note amount."),
      reason: z.string().optional(),
      batchIds: z.array(z.number()).default([]),
      file: z
        .object({
          name: z.string(),
          mimeType: z.string().regex(ALLOWED_MIME, "Upload a photo (JPG/PNG/WebP) or a PDF."),
          base64: z.string().max(MAX_FILE_BASE64_LENGTH, "File is too large — keep it under 5 MB."),
        })
        .optional(),
    }),
  )
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [supplier] = await db
        .select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, data.supplierId));
      if (!supplier) throw new Error("Supplier not found.");
      const [inserted] = await db
        .insert(creditNotes)
        .values({
          supplierId: data.supplierId,
          noteNumber: data.noteNumber?.trim() || null,
          noteDate: data.noteDate || null,
          amount: Math.round(data.amount * 100) / 100,
          reason: data.reason?.trim() || null,
          batchIdsJson: JSON.stringify(data.batchIds),
          fileName: data.file?.name ?? null,
          fileMimeType: data.file?.mimeType ?? null,
          fileData: data.file?.base64 ?? null,
        })
        .returning({ id: creditNotes.id });
      return { id: inserted.id };
    });
  });

export const deleteCreditNote = createServerFn({ method: "POST" })
  .inputValidator(z.object({ id: z.number() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      // A note already deducted from a purchase bill is part of that bill's record — deleting it
      // would leave the purchase showing a deduction with nothing behind it.
      const [used] = await db
        .select({ id: creditNoteApplications.id })
        .from(creditNoteApplications)
        .where(eq(creditNoteApplications.creditNoteId, data.id))
        .limit(1);
      if (used)
        throw new Error(
          "This credit note has already been deducted from a purchase bill and can't be deleted.",
        );
      await db.delete(creditNotes).where(eq(creditNotes.id, data.id));
      return { ok: true };
    });
  });
