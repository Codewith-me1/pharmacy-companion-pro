import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { getDb } from "../db/client.server";
import { withTenant } from "../db/tenant.server";
import { users, businessSettings } from "../db/schema";
import { hashPassword, verifyPassword, needsRehash } from "../auth/password.server";
import { getSessionUserId, setSessionUser, clearSessionUser } from "../auth/session.server";
import {
  assertNotRateLimited,
  clearRateLimit,
  clientIp,
  loginRules,
  registerFailure,
  signupRules,
} from "../auth/rate-limit.server";

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
      pharmacyName: z.string().min(1, "Pharmacy name is required"),
      mobile: z.string().min(1, "Mobile number is required"),
      dlNo: z.string().optional(),
      gstNumber: z.string().optional(),
      address: z.string().optional(),
      email: z.string().email("Enter a valid email address"),
      password: z.string().min(8, "Password must be at least 8 characters"),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    // Caps automated account creation from a single source; a real pharmacy signs up once.
    const rules = signupRules(clientIp());
    await assertNotRateLimited(rules);
    await registerFailure(rules);

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    if (existing) {
      throw new Error("An account with this email already exists. Try logging in instead.");
    }

    const passwordHash = await hashPassword(data.password);
    const [user] = await db
      .insert(users)
      .values({ email, passwordHash, name: data.name.trim(), pharmacyName: data.pharmacyName.trim() })
      .returning();

    // Give every new account a starter business-settings row pre-filled from signup, so
    // Settings/Sales/Billing don't have to handle a "no row yet" case, and bills print correctly
    // from the very first sale instead of needing a trip to Settings first.
    await withTenant(user.id, async (db) => {
      await db.insert(businessSettings).values({
        firmName: data.pharmacyName.trim(),
        mobile: data.mobile.trim(),
        dlNo: data.dlNo?.trim() || undefined,
        gstNumber: data.gstNumber?.trim() || undefined,
        address: data.address?.trim() || undefined,
      });
    });

    await setSessionUser(user.id);
    return { id: user.id };
  });

export const login = createServerFn({ method: "POST" })
  .inputValidator(z.object({ email: z.string().email(), password: z.string().min(1) }))
  .handler(async ({ data }) => {
    const db = getDb();
    const email = data.email.trim().toLowerCase();
    const rules = loginRules(email, clientIp());
    // Throws (and the attempt never reaches the password check) once this account or address has
    // burned through its allowance — see rate-limit.server.ts.
    await assertNotRateLimited(rules);

    const [user] = await db.select().from(users).where(eq(users.email, email));
    if (!user) {
      await registerFailure(rules);
      // Deliberately identical to the wrong-password message: a distinct "no such account" reply
      // turns this endpoint into a way to enumerate which pharmacies are registered.
      throw new Error("Invalid email or password.");
    }
    const ok = await verifyPassword(data.password, user.passwordHash);
    if (!ok) {
      await registerFailure(rules);
      throw new Error("Invalid email or password.");
    }

    await clearRateLimit(rules);

    // The password is only available in plaintext at this instant, so this is the one chance to
    // re-hash an old weak-parameter record. Failure here must not fail the login.
    if (needsRehash(user.passwordHash)) {
      try {
        const upgraded = await hashPassword(data.password);
        await db.update(users).set({ passwordHash: upgraded }).where(eq(users.id, user.id));
      } catch (err) {
        console.error("[AUTH] password rehash failed:", (err as Error).message);
      }
    }

    await setSessionUser(user.id);
    return { id: user.id };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  await clearSessionUser();
  return { ok: true };
});
