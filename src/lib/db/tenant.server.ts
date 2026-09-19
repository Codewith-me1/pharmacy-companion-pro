import { drizzle } from "drizzle-orm/node-postgres";
import { getDb, getPool } from "./client.server";
import * as schema from "./schema";

// Every tenant-scoped table has Row-Level Security enabled with a policy that only allows
// seeing/writing rows where owner_id = current_setting('app.current_user_id'). Running a
// handler's queries inside this transaction sets that session variable with `set_config(...,
// true)` — the `true` (is_local) makes it scoped to THIS transaction only, so it can never
// leak across pooled connections shared with other requests/tenants. Postgres enforces the
// isolation itself: even a forgotten WHERE clause in application code cannot leak another
// tenant's rows, and INSERTs without an explicit ownerId get it from the column default, which
// reads the same session variable.
//
// The connection is checked out and driven directly rather than through drizzle's `.transaction()`
// because that helper sends BEGIN as its own statement. Every statement is a full network round
// trip (measured at ~150-185ms to the current region), so a handler doing one query cost four of
// them: BEGIN, set_config, the query, COMMIT — three quarters of it overhead. Sending BEGIN and
// set_config together as a single simple query removes one round trip from every tenant-scoped
// request in the app.
export async function withTenant<T>(
  userId: number,
  fn: (db: ReturnType<typeof getDb>) => Promise<T>,
): Promise<T> {
  // The combined statement cannot use bind parameters (the simple query protocol has none), so
  // the id is interpolated — which makes this check the thing standing between a session value
  // and SQL injection. userId comes from the sealed session cookie, but validate it regardless:
  // the cost is nothing and the failure mode is total.
  if (!Number.isInteger(userId) || userId <= 0) {
    throw new Error(`withTenant called with an invalid user id: ${JSON.stringify(userId)}`);
  }

  const client = await getPool().connect();
  try {
    // All of it in ONE round trip. The timeouts are also set as defaults on the medios_app role
    // (scripts/provision-app-role.ts), but Supavisor hands out backend sessions that were opened
    // before those defaults existed — a live connection reported statement_timeout=2min and
    // idle_in_transaction_session_timeout=0 despite the role setting — so the role default cannot
    // be relied on. Setting them here transaction-locally is authoritative and, folded into this
    // statement, free.
    await client.query(
      `begin; select set_config('app.current_user_id', '${userId}', true),` +
        ` set_config('statement_timeout', '15s', true),` +
        ` set_config('idle_in_transaction_session_timeout', '10s', true);`,
    );

    const tx = drizzle(client, { schema }) as unknown as ReturnType<typeof getDb>;
    const result = await fn(tx);

    await client.query("commit");
    return result;
  } catch (error) {
    // Roll back on any failure. A rollback that itself fails (connection already gone) must not
    // mask the original error.
    await client.query("rollback").catch(() => {});
    const err = error as NodeJS.ErrnoException & Record<string, unknown>;
    console.error("[DB TENANT TX FAILED]", {
      userId,
      message: err?.message,
      code: err?.code,
      detail: err?.detail,
      table: err?.table,
      constraint: err?.constraint,
    });
    throw error;
  } finally {
    // Always hand the connection back, including when the handler threw. Without this the pool
    // leaks a connection per failure and the app wedges after `max` of them.
    client.release();
  }
}
