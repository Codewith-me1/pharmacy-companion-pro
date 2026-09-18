import process from "node:process";
import { sql } from "drizzle-orm";
import { getRequestIP } from "@tanstack/react-start/server";
import { getDb } from "../db/client.server";

/**
 * Brute-force protection for the unauthenticated endpoints (login, signup).
 *
 * Without it, `login` is an unlimited password-guessing oracle: the only thing standing between an
 * attacker and a pharmacy's entire sales, customer and stock history is how fast they can send
 * POSTs. Counters live in Postgres rather than in process memory on purpose — the app is deployed
 * to serverless containers, where an in-memory counter resets with every cold start and is not
 * shared between concurrent containers, making it trivial to outrun.
 */

export type RateLimitRule = {
  bucket: string;
  identifier: string;
  /** Failures allowed inside the window before the identifier is locked out. */
  limit: number;
  windowMs: number;
  lockMs: number;
};

export class RateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(`Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`);
    this.name = "RateLimitError";
  }
}

const MINUTE = 60_000;

/**
 * Client address for IP-based limiting.
 *
 * X-Forwarded-For is only trusted when the app is knowingly behind a proxy that overwrites it
 * (Vercel, or an explicit TRUST_PROXY). Trusting it unconditionally would let any caller spoof the
 * header and hand themselves a fresh quota on every request, which is worse than no IP limit at
 * all because it looks like protection.
 */
export function clientIp(): string {
  const behindProxy = Boolean(process.env.VERCEL || process.env.TRUST_PROXY);
  try {
    return getRequestIP({ xForwardedFor: behindProxy }) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export function loginRules(email: string, ip: string): RateLimitRule[] {
  return [
    // Per-account: stops a sustained guessing run against one pharmacy's login.
    { bucket: "login:email", identifier: email, limit: 8, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
    // Per-address: stops one host spraying a common password across many accounts. Set higher so
    // a whole pharmacy behind one NAT address isn't locked out by a few genuine typos.
    { bucket: "login:ip", identifier: ip, limit: 40, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE },
  ];
}

export function signupRules(ip: string): RateLimitRule[] {
  return [{ bucket: "signup:ip", identifier: ip, limit: 10, windowMs: 60 * MINUTE, lockMs: 60 * MINUTE }];
}

/** Throws RateLimitError if any rule is currently locked out. */
export async function assertNotRateLimited(rules: RateLimitRule[]): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    const pairs = sql.join(
      rules.map((r) => sql`(${r.bucket}, ${r.identifier})`),
      sql`, `,
    );
    const result = await getDb().execute(
      sql`select locked_until from rate_limits
           where (bucket, identifier) in (${pairs})
             and locked_until is not null
             and locked_until > ${nowIso}
           order by locked_until desc
           limit 1`,
    );
    const row = (result.rows ?? result)[0] as { locked_until: string } | undefined;
    if (row) {
      const retryAfter = Math.ceil((new Date(row.locked_until).getTime() - now.getTime()) / 1000);
      throw new RateLimitError(Math.max(1, retryAfter));
    }
  } catch (err) {
    // A failure to READ the limiter must not become a failure to log in — but a genuine lockout
    // (RateLimitError) is a decision, not an error, so let it through.
    if (err instanceof RateLimitError) throw err;
    console.error("[RATE LIMIT] check failed, allowing request:", (err as Error).message);
  }
}

/** Records one failed attempt against every rule, locking out those that cross their limit. */
export async function registerFailure(rules: RateLimitRule[]): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  try {
    const db = getDb();
    for (const rule of rules) {
      const cutoff = new Date(now.getTime() - rule.windowMs).toISOString();
      const lockUntil = new Date(now.getTime() + rule.lockMs).toISOString();
      await db.execute(
        sql`insert into rate_limits (bucket, identifier, attempts, window_started_at, locked_until)
            values (${rule.bucket}, ${rule.identifier}, 1, ${nowIso}, null)
            on conflict (bucket, identifier) do update set
              -- A window that has already elapsed starts over at 1 rather than accumulating
              -- forever, so an occasional typo months apart never adds up to a lockout.
              attempts = case when rate_limits.window_started_at < ${cutoff}
                              then 1 else rate_limits.attempts + 1 end,
              window_started_at = case when rate_limits.window_started_at < ${cutoff}
                                       then ${nowIso} else rate_limits.window_started_at end,
              locked_until = case
                when rate_limits.window_started_at >= ${cutoff}
                     and rate_limits.attempts + 1 >= ${rule.limit}
                then ${lockUntil}
                else rate_limits.locked_until
              end`,
      );
    }
  } catch (err) {
    console.error("[RATE LIMIT] could not record failure:", (err as Error).message);
  }
}

/** Clears counters after a genuine success, so normal use never drifts toward a lockout. */
export async function clearRateLimit(rules: RateLimitRule[]): Promise<void> {
  try {
    const pairs = sql.join(
      rules.map((r) => sql`(${r.bucket}, ${r.identifier})`),
      sql`, `,
    );
    await getDb().execute(sql`delete from rate_limits where (bucket, identifier) in (${pairs})`);
  } catch (err) {
    console.error("[RATE LIMIT] could not clear counters:", (err as Error).message);
  }
}
