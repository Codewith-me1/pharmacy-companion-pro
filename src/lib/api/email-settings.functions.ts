import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { emailSettings } from "../db/schema";
import { withTenant } from "../db/tenant.server";
import { requireUserId } from "../auth/require-user.server";

export const getEmailSettings = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await requireUserId();
  return withTenant(userId, async (db) => {
    const [row] = await db.select().from(emailSettings).limit(1);
    if (!row) return null;
    // Never send the stored password back to the client.
    return {
      id: row.id,
      email: row.email,
      imapHost: row.imapHost,
      imapPort: row.imapPort,
      useTls: row.useTls,
      enabled: row.enabled,
      hasPassword: !!row.password,
    };
  });
});

const saveInput = z.object({
  email: z.string().optional(),
  imapHost: z.string().optional(),
  imapPort: z.number().default(993),
  useTls: z.boolean().default(true),
  enabled: z.boolean().default(false),
  password: z.string().optional(), // leave blank to keep the existing stored password
});

export const saveEmailSettings = createServerFn({ method: "POST" })
  .inputValidator(saveInput)
  .handler(async ({ data }) => {
    const userId = await requireUserId();
    return withTenant(userId, async (db) => {
      const [existing] = await db.select().from(emailSettings).limit(1);
      const values = {
        email: data.email,
        imapHost: data.imapHost,
        imapPort: data.imapPort,
        useTls: data.useTls,
        enabled: data.enabled,
        ...(data.password ? { password: data.password } : {}),
      };
      if (existing) {
        await db.update(emailSettings).set(values).where(eq(emailSettings.id, existing.id));
        return { id: existing.id };
      }
      const [inserted] = await db.insert(emailSettings).values(values).returning();
      return { id: inserted.id };
    });
  });

export const testEmailConnection = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      email: z.string(),
      imapHost: z.string(),
      imapPort: z.number(),
      useTls: z.boolean(),
      password: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    await requireUserId(); // no DB access needed, just gate this to logged-in users
    const { ImapFlow } = await import("imapflow");
    const client = new ImapFlow({
      host: data.imapHost,
      port: data.imapPort,
      secure: data.useTls,
      auth: { user: data.email, pass: data.password },
      logger: false,
    });
    try {
      await client.connect();
      await client.logout();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Connection failed." };
    }
  });
