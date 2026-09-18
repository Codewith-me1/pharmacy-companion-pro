import process from "node:process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { sslConfigFor } from "./ssl.server";

// Server-only. Never imported from client code (see config.server.ts convention).
let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    // APP_DATABASE_URL connects as a restricted role with no BYPASSRLS — required for the
    // per-tenant Row-Level Security policies (see tenant.server.ts) to actually be enforced.
    // DATABASE_URL is the admin/migration role: on Supabase that is `postgres`, which carries
    // rolbypassrls = true, so every tenant policy silently stops applying and one pharmacy can
    // read another's data. That fallback is therefore refused outright in production rather than
    // left as a quietly insecure default.
    const connectionString = process.env.APP_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("APP_DATABASE_URL (or DATABASE_URL) is not set. Add it to your .env file (see .env.example).");
    }
    if (!process.env.APP_DATABASE_URL) {
      const message =
        "APP_DATABASE_URL is not set, so the app would connect with the admin role. That role can " +
        "bypass Row-Level Security, which disables every per-pharmacy isolation policy. " +
        "Provision the restricted role (npm run db:provision-app-role) and set APP_DATABASE_URL.";
      if (process.env.NODE_ENV === "production") throw new Error(message);
      console.warn(`[DB SECURITY] ${message}`);
    }
    // On Vercel, every concurrent request can land in its own serverless container with its own
    // module scope — i.e. its own Pool. Connections go through Supabase's Supavisor pooler, which
    // multiplexes them onto a much smaller set of real Postgres backends, but each container's
    // own pool should still stay small and hand connections back quickly so a frozen container
    // does not sit on a client slot.
    const isServerless = Boolean(process.env.VERCEL);
    pool = new Pool({
      connectionString,
      ssl: sslConfigFor(connectionString),
      // Names this app in pg_stat_activity and Supabase's dashboard, so a runaway query can be
      // attributed to it rather than to an anonymous connection.
      application_name: "medios-pharmacy",
      // Without these, a stalled connection attempt (network blip, provider-side idle
      // disconnect, etc.) can hang a request indefinitely instead of failing fast, and a
      // dropped idle connection can throw an unhandled error that crashes the process.
      max: isServerless ? 1 : 5,
      idleTimeoutMillis: isServerless ? 3_000 : 10_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      // Let the pool release its connection instead of keeping the process alive once idle —
      // matters on serverless, where a container can otherwise sit frozen holding a slot that
      // never gets returned to the pooler until the container is eventually recycled.
      allowExitOnIdle: isServerless,
    });
    pool.on("error", (err) => {
      console.error("Postgres pool error (idle connection dropped):", err.message);
    });

    // Drizzle wraps every failed query in a DrizzleQueryError whose own .message is just a
    // generic "Failed query: ...params: ..." template — the real Postgres error (auth failure,
    // missing table, constraint violation, connection timeout, etc.) only survives on a nested
    // .cause property that gets silently dropped when the error is sent to the browser. Log the
    // full detail here so it's always visible in the server console/logs, regardless of what the
    // client ends up seeing.
    const rawQuery = pool.query.bind(pool);
    pool.query = ((...args: Parameters<typeof rawQuery>) => {
      const attempt = (): Promise<unknown> => {
        const result = rawQuery(...args) as unknown;
        if (!result || typeof (result as PromiseLike<unknown>).then !== "function") {
          return Promise.resolve(result);
        }
        return (result as Promise<unknown>).catch((err: NodeJS.ErrnoException & Record<string, unknown>) => {
          // Connection-acquisition failures (the pooler's client-connection cap hit by concurrent serverless
          // containers, a momentary network blip) are transient — a slot frees up milliseconds
          // later as other containers finish. Retry once before giving up; anything else (bad
          // SQL, constraint violation, etc.) fails immediately since retrying won't help.
          const isConnectionExhaustion =
            err?.code === "53300" ||
            /too many clients|remaining connection slots|terminating connection/i.test(err?.message ?? "");
          if (isConnectionExhaustion && !hasRetried) {
            hasRetried = true;
            console.error("[DB QUERY RETRY] connection exhaustion, retrying once:", err?.message);
            return new Promise((resolve) => setTimeout(resolve, 300)).then(attempt);
          }
          console.error("[DB QUERY FAILED]", {
            message: err?.message,
            code: err?.code,
            detail: err?.detail,
            hint: err?.hint,
            table: err?.table,
            column: err?.column,
            constraint: err?.constraint,
          });
          throw err;
        });
      };
      let hasRetried = false;
      return attempt();
    }) as typeof pool.query;
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
