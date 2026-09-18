import { sql } from "drizzle-orm";
import { getDb } from "./client.server";

// Every tenant-scoped table has Row-Level Security enabled with a policy that only allows
// seeing/writing rows where owner_id = current_setting('app.current_user_id'). Running a
// handler's queries inside this transaction sets that session variable with `set_config(...,
// true)` — the `true` (is_local) makes it scoped to THIS transaction only, so it can never
// leak across pooled connections shared with other requests/tenants. Postgres enforces the
// isolation itself: even a forgotten WHERE clause in application code cannot leak another
// tenant's rows, and INSERTs without an explicit ownerId get it from the column default, which
// reads the same session variable.
export async function withTenant<T>(
  userId: number,
  fn: (db: ReturnType<typeof getDb>) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => {
    // All three are set in ONE round trip, and all are transaction-local (set_config's third
    // argument): with the database behind a transaction pooler the underlying backend is shared
    // with other tenants between transactions, so anything set non-locally would leak across
    // them. The two timeouts bound the damage a pathological query or an abandoned transaction
    // can do — without them a single stuck statement holds a pooler slot indefinitely.
    await tx.execute(
      sql`select set_config('app.current_user_id', ${String(userId)}, true),
                 set_config('statement_timeout', '15s', true),
                 set_config('idle_in_transaction_session_timeout', '10s', true)`,
    );
    return fn(tx as unknown as ReturnType<typeof getDb>);
  });
}
