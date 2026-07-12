import process from "node:process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Server-only. Never imported from client code (see config.server.ts convention).
let pool: Pool | undefined;

function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set. Add it to your .env file (see .env.example).");
    }
    // Managed Postgres providers (Aiven, Supabase, Neon, RDS, etc.) require TLS and reject
    // plaintext connections outright. Local Docker/native Postgres has no TLS configured at
    // all, so only enable it for non-local hosts.
    const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
    // On Vercel, every concurrent request can land in its own serverless container with its
    // own module scope — i.e. its own Pool. Aiven's free/starter tier caps max_connections at
    // 20 total, shared across every container. A `max` of 5 here means as few as 4 concurrent
    // containers can exhaust the entire database's connection budget, which surfaces as the
    // exact same generic "Failed query" error on totally unrelated, trivially correct queries.
    // Keep each container's own pool small and release idle connections fast so slots return
    // to Aiven quickly instead of being held by frozen/idle containers.
    const isServerless = Boolean(process.env.VERCEL);
    pool = new Pool({
      connectionString,
      ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
      // Without these, a stalled connection attempt (network blip, provider-side idle
      // disconnect, etc.) can hang a request indefinitely instead of failing fast, and a
      // dropped idle connection can throw an unhandled error that crashes the process.
      max: isServerless ? 1 : 5,
      idleTimeoutMillis: isServerless ? 3_000 : 10_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      // Let the pool release its connection instead of keeping the process alive once idle —
      // matters on serverless, where a container can otherwise sit frozen holding a slot that
      // never gets returned to Aiven until the container is eventually recycled.
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
          // Connection-acquisition failures (Aiven's connection cap hit by concurrent serverless
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
