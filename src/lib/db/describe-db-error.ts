/**
 * Turns a database failure into a message that says what is actually wrong.
 *
 * Drizzle wraps every failed query in a DrizzleQueryError whose own message is the same generic
 * template for every cause: `Failed query: select "id" from "users" where ... params: ...`. The
 * real Postgres or socket error survives only on a nested `.cause`, which is dropped when the
 * error is serialized to the browser. The result is that a dead host, a wrong password, an
 * un-migrated database and a genuine SQL bug are indistinguishable to whoever is looking at the
 * screen.
 *
 * Messages here name the category and the fix, but deliberately never include the host, role,
 * database name or connection string: login and signup are unauthenticated endpoints, so whatever
 * they return is readable by anyone. The full detail is already written to the server log by
 * client.server.ts, and `npm run db:doctor` prints it locally.
 */

type PgLikeError = Error & { code?: string; detail?: string; severity?: string };

function findCause(error: unknown): PgLikeError | undefined {
  let current: unknown = error;
  for (let depth = 0; current instanceof Error && depth < 6; depth++) {
    const candidate = current as PgLikeError;
    if (typeof candidate.code === "string" && candidate.code.length > 0) return candidate;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

const SUFFIX = "The server log and `npm run db:doctor` have the full detail.";

/** Returns a clearer Error for a database failure, or the original error for anything else. */
export function describeDatabaseError(error: unknown): unknown {
  const cause = findCause(error);
  if (!cause) return error;

  const message = (() => {
    switch (cause.code) {
      case "ENOTFOUND":
        return (
          "The database host could not be found (DNS lookup failed). The connection settings in " +
          "this environment point at a server that no longer exists."
        );
      case "ECONNREFUSED":
        return "The database refused the connection — nothing is listening on that host and port.";
      case "ETIMEDOUT":
      case "ECONNRESET":
        return (
          "The connection to the database timed out. If the host is Supabase's direct endpoint " +
          "(db.<ref>.supabase.co) it is IPv6-only and unreachable from most networks — use the " +
          "pooler host instead."
        );
      case "28P01":
      case "28000":
        return "The database rejected the credentials for this environment.";
      case "3D000":
        return "The configured database name does not exist on that server.";
      case "42P01":
        return "A required table is missing — migrations have not been run against this database.";
      case "42501":
        return "The database role is missing privileges for this table.";
      case "53300":
        return "The database is out of connection slots. Try again in a moment.";
      case "57014":
        return "The query took too long and was cancelled.";
      case "SELF_SIGNED_CERT_IN_CHAIN":
      case "UNABLE_TO_VERIFY_LEAF_SIGNATURE":
      case "DEPTH_ZERO_SELF_SIGNED_CERT":
        return "The database server's TLS certificate could not be verified.";
      default:
        return undefined;
    }
  })();

  if (!message) return error;

  const described = new Error(`${message} ${SUFFIX}`);
  described.cause = error;
  return described;
}
