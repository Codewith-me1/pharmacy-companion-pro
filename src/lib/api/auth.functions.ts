import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { withTenant } from "../db/tenant.server";
import { users, businessSettings } from "../db/schema";
import { hashPassword, verifyPassword } from "../auth/password.server";
import { getSessionUserId, setSessionUser, clearSessionUser } from "../auth/session.server";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const db = getDb();
  const [user] = await db
    .select({ id: users.id, email: users.email, name: users.name, pharmacyName: users.pharmacyName })
    .from(users)
    .where(eq(users.id, userId));
  return user ?? null;
});

export const signup = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      name: z.string().min(1, "Name is required"),
      pharmacyName: z.string().optional(),
      email: z.string().email("Enter a valid email address"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      throw new Error("An account with this email already exists. Try logging in instead.");
    }

    const passwordHash = await hashPassword(data.password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, name: data.name.trim(), pharmacyName: data.pharmacyName?.trim() })
      .returning();

    // Give every new account a starter business-settings row so Settings/Sales/Billing don't
    // have to handle a "no row yet" case differently from "row exists but blank".
    await withTenant(user.id, async (db) => {
      await db.insert(businessSettings).values({ firmName: data.pharmacyName?.trim() || data.name.trim() });
    });

    await setSessionUser(user.id);
    return { id: user.id };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      throw new Error("Invalid email or password.");
    }
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) {
      throw new Error("Invalid email or password.");
    }
    await setSessionUser(user.id);
    return { id: user.id };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await clearSessionUser();
  return { ok: true };
});
