/**
 * Diagnoses a database connection, step by step, and says what to do about each failure.
 *
 *   npm run db:doctor
 *
 * Exists because Drizzle reports every failure as the same opaque "Failed query: select ..." in
 * the browser — the real cause (host does not resolve, password rejected, table missing) is only
 * on a nested .cause the client never sees. This walks the same path the app takes and names the
 * actual problem.
 */
import process from "node:process";
import dns from "node:dns/promises";
import { Client } from "pg";
import { sslConfigFor } from "../src/lib/db/ssl.server";

let problems = 0;
const ok = (m: string) => console.log(`  [ok]   ${m}`);
const bad = (m: string, fix: string) => {
  console.log(`  [FAIL] ${m}`);
  console.log(`         -> ${fix}`);
  problems++;
};

async function diagnose(label: string, raw: string | undefined, envName: string, isRuntime: boolean) {
  console.log(`\n${label} (${envName})`);
  if (!raw) {
    bad(`${envName} is not set`, `Add it to .env (see .env.example), and to your deployment's environment variables.`);
    return;
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    bad(`${envName} is not a valid connection URL`, "Expected postgresql://user:password@host:port/database");
    return;
  }
  const role = decodeURIComponent(url.username);
  console.log(`  host=${url.hostname}:${url.port || 5432} role=${role} db=${url.pathname.slice(1)}`);

  // 1. DNS — the failure mode that produced the reported error.
  let hasV4 = false;
  try {
    const a = await dns.resolve4(url.hostname);
    hasV4 = a.length > 0;
    ok(`hostname resolves to IPv4 ${a[0]}`);
  } catch {
    try {
      await dns.resolve6(url.hostname);
      bad(
        "hostname has an IPv6 address but no IPv4 address",
        "Supabase's direct host (db.<ref>.supabase.co) is IPv6-only and unreachable from most " +
          "networks and serverless platforms. Use the Supavisor pooler host instead: " +
          "aws-<n>-<region>.pooler.supabase.com (session 5432 / transaction 6543).",
      );
    } catch {
      bad(
        "hostname does not resolve at all",
        "The database server no longer exists, or the host is misspelled. Check the connection " +
          "string in your provider's dashboard.",
      );
    }
    if (!hasV4) return;
  }

  // 2. TCP + TLS + authentication.
  const client = new Client({ connectionString: raw, ssl: sslConfigFor(raw), connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    ok("connected, TLS certificate verified, credentials accepted");
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { code?: string };
    const code = err.code ?? "";
    if (code === "ECONNREFUSED") bad("connection refused", "The host resolves but nothing is listening on that port.");
    else if (code === "ETIMEDOUT") bad("connection timed out", "A firewall or network policy is blocking the port.");
    else if (code === "28P01") bad("password authentication failed", "Re-run: npm run db:provision-app-role -- --write-env");
    else if (code === "3D000") bad("database does not exist", "Check the database name at the end of the URL.");
    else if (code === "SELF_SIGNED_CERT_IN_CHAIN" || code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE")
      bad("TLS certificate could not be verified", "The provider's CA is not trusted. For Supabase this should not happen — check src/lib/db/supabase-ca.ts.");
    else bad(`connection failed: ${err.message.split("\n")[0]}`, "See the error code above.");
    return;
  }

  // 3. Schema and privileges.
  try {
    const t = await client.query(
      `select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = 'users'`,
    );
    if (t.rows[0].n === 1) ok("schema present (users table found)");
    else bad("the users table is missing", "Run: npm run db:migrate");

    const who = await client.query(
      `select current_user as who, (select rolbypassrls from pg_roles where rolname = current_user) as bypass`,
    );
    const { who: role2, bypass } = who.rows[0];
    if (bypass && isRuntime) {
      // Only a problem for the connection the APP uses. The migration role is *meant* to bypass
      // RLS — it has to create and alter the very policies that enforce it.
      bad(
        `connected role '${role2}' can BYPASS Row-Level Security`,
        "Every per-pharmacy isolation policy is inert for this role. The app must use " +
          "APP_DATABASE_URL (role medios_app), not the admin role.",
      );
    } else if (bypass) {
      ok(`role '${role2}' bypasses RLS — expected for the migration role, never used at runtime`);
    } else {
      ok(`role '${role2}' is subject to Row-Level Security`);
    }

    const users = await client.query(`select count(*)::int as n from users`);
    console.log(`  accounts in this database: ${users.rows[0].n}`);
    if (users.rows[0].n === 0) {
      console.log("         -> empty: sign up in the app, or copy data with npm run db:migrate-data -- --apply");
    }
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { code?: string };
    if (err.code === "42501") bad("permission denied on the users table", "Re-run: npm run db:provision-app-role");
    else bad(`query failed: ${err.message.split("\n")[0]}`, `Postgres code ${err.code ?? "?"}`);
  } finally {
    await client.end();
  }
}

console.log("Database doctor");
console.log(`NODE_ENV=${process.env.NODE_ENV ?? "(unset)"}  VERCEL=${process.env.VERCEL ?? "(unset)"}`);

await diagnose("Runtime connection used by the app", process.env.APP_DATABASE_URL, "APP_DATABASE_URL", true);
await diagnose("Admin connection used by migrations", process.env.DATABASE_URL, "DATABASE_URL", false);

console.log(`\nSESSION_SECRET: ${
  !process.env.SESSION_SECRET
    ? "MISSING — the app will not start"
    : process.env.SESSION_SECRET.length < 32
      ? `too short (${process.env.SESSION_SECRET.length} chars, need 32+)`
      : "ok"
}`);

console.log("\n" + "=".repeat(60));
console.log(problems === 0 ? "No problems found." : `${problems} problem(s) found — see the -> lines above.`);
if (problems > 0) process.exitCode = 1;
