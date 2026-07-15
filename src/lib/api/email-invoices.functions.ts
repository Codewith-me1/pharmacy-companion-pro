import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { buffer as streamToBuffer } from "node:stream/consumers";
import { getImapClient } from "../imap-client.server";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

const ATTACHMENT_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"]);

type StructureNode = {
  part?: string;
  type: string;
  parameters?: Record<string, unknown>;
  disposition?: string;
  dispositionParameters?: Record<string, unknown>;
  childNodes?: StructureNode[];
  size?: number;
};

function findAttachments(node: StructureNode | undefined, results: { part: string; filename: string; type: string; size?: number }[] = []) {
  if (!node) return results;
  const contentType = node.type?.toLowerCase();
  const filename = (node.dispositionParameters?.filename as string) || (node.parameters?.name as string);
  const looksLikeAttachment = node.disposition === "attachment" || (!!filename && node.disposition !== "inline");

  if (node.part && looksLikeAttachment && contentType && ATTACHMENT_TYPES.has(contentType)) {
    results.push({ part: node.part, filename: filename || `attachment-${node.part}`, type: contentType, size: node.size });
  }
  for (const child of node.childNodes ?? []) {
    findAttachments(child, results);
  }
  return results;
}

export const listSupplierInvoiceEmails = createServerFn({ method: "GET" })
  .inputValidator(z.object({ days: z.number().default(30) }).optional())
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    // Look up IMAP credentials in a brief scoped transaction, then release it before the
    // potentially slow IMAP session (connect + scan up to 100 emails) — no need to hold a
    // pooled DB connection for that whole time.
    const client = await withTenant(userId, (db) => getImapClient(db));
    await client.connect();
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const since = new Date();
        since.setDate(since.getDate() - (data?.days ?? 30));

        const uids = await client.search({ since }, { uid: true });
        const recentUids = uids.slice(-100); // cap scan size
        if (recentUids.length === 0) return [];

        const results: {
          uid: number;
          subject: string;
          from: string;
          date: string;
          attachments: { part: string; filename: string; type: string; size?: number }[];
        }[] = [];

        for await (const message of client.fetch(recentUids, { envelope: true, bodyStructure: true }, { uid: true })) {
          const attachments = findAttachments(message.bodyStructure as StructureNode);
          if (attachments.length === 0) continue;
          results.push({
            uid: message.uid,
            subject: message.envelope?.subject ?? "(no subject)",
            from: message.envelope?.from?.[0]?.address ?? message.envelope?.from?.[0]?.name ?? "Unknown sender",
            date: message.envelope?.date ? new Date(message.envelope.date).toISOString() : "",
            attachments,
          });
        }

        return results.sort((a, b) => b.uid - a.uid);
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  });

export const fetchEmailAttachment = createServerFn({ method: "POST" })
  .inputValidator(z.object({ uid: z.number(), part: z.string() }))
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    const client = await withTenant(userId, (db) => getImapClient(db));
    await client.connect();
    try {
      const lock = await client.getMailboxLock("INBOX");
      try {
        const { content, meta } = await client.download(String(data.uid), data.part, { uid: true });
        const buf = await streamToBuffer(content);
        return {
          base64: buf.toString("base64"),
          mimeType: meta.contentType,
          filename: meta.filename ?? `attachment.${meta.contentType.split("/")[1] ?? "bin"}`,
        };
      } finally {
        lock.release();
      }
    } finally {
      await client.logout().catch(() => {});
    }
  });
