/**
 * Creates (or re-keys) the restricted database role the running app connects as.
 *
 * Why this exists: Supabase's `postgres` role has rolbypassrls = true. Every per-pharmacy
 * Row-Level Security policy in drizzle/0004_*.sql is silently inert for that role, so an app
 * running as `postgres` would happily serve one pharmacy's stock, sales and customers to another.
 * The runtime therefore connects as this role instead, which has no BYPASSRLS, no DDL rights and
 * no ownership of anything — only the DML the app actually issues.
 *
 *   npm run db:provision-app-role
 *
 * Idempotent: re-running it rotates the password and re-applies the grants. Prints the
 * APP_DATABASE_URL to copy into .env (and into the deployment's environment variables).
 */
import process from "node:process";
import { randomInt } from "node:crypto";
import { Client } from "pg";
import { sslConfigFor } from "../src/lib/db/ssl.server";

const ROLE = "medios_app";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Alphanumeric only: the password is embedded in a URL, and percent-encoding bugs in connection
// strings are a classic source of "password authentication failed" that looks like a config error.
function generatePassword(length = 40): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const adminUrl = process.env.DATABASE_URL;
if (!adminUrl) throw new Error("DATABASE_URL (admin/session-mode connection) is not set.");

const password = process.env.APP_DB_PASSWORD || generatePassword();
// Doubling single quotes is the standard Postgres literal escape; the generated password is
// alphanumeric anyway, but an operator-supplied APP_DB_PASSWORD may not be.
const quoted = `'${password.replace(/'/g, "''")}'`;

const client = new Client({ connectionString: adminUrl, ssl: sslConfigFor(adminUrl) });
await client.connect();

const db = (await client.query("select current_database() as db")).rows[0].db as string;

const exists = (await client.query("select 1 from pg_roles where rolname = $1", [ROLE])).rowCount === 1;
if (exists) {
  console.log(`role ${ROLE} already exists — rotating password and re-applying grants`);
  await client.query(`alter role ${ROLE} with login password ${quoted}`);
} else {
  console.log(`creating role ${ROLE}`);
  await client.query(`create role ${ROLE} with login password ${quoted}`);
}

// CREATE ROLE already defaults to NOSUPERUSER / NOCREATEDB / NOCREATEROLE / NOREPLICATION /
// NOBYPASSRLS, and Supabase's supautils extension rejects an ALTER ROLE that mentions those
// attributes at all ("Only roles with the SUPERUSER attribute may alter roles with the SUPERUSER
// attribute"). So rather than setting them, assert them below — a role that somehow has any of
// them is a hard failure, not something to paper over.

const statements = [
  `grant connect on database "${db}" to ${ROLE}`,
  `grant usage on schema public to ${ROLE}`,
  // Exactly the four verbs the app issues. Notably absent: TRUNCATE (mass deletion in one
  // statement) and REFERENCES, plus any DDL — schema changes belong to migrations only.
  `grant select, insert, update, delete on all tables in schema public to ${ROLE}`,
  `grant usage, select on all sequences in schema public to ${ROLE}`,
  // Future tables created by later migrations inherit the same grants, so a new migration cannot
  // accidentally leave the app unable to read its own table (or, worse, tempt someone to fix it
  // by pointing the app back at the admin role).
  `alter default privileges in schema public grant select, insert, update, delete on tables to ${ROLE}`,
  `alter default privileges in schema public grant usage, select on sequences to ${ROLE}`,
  // The app must never create objects; DDL is the migration role's job alone.
  `revoke create on schema public from ${ROLE}`,
];
for (const sql of statements) {
  await client.query(sql);
  console.log(`  ${sql}`);
}

const check = await client.query(
  `select rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolreplication
     from pg_roles where rolname = $1`,
  [ROLE],
);
console.log("\nrole attributes (all must be false):");
console.table(check.rows);

const attrs = check.rows[0] as Record<string, boolean>;
const dangerous = Object.entries(attrs).filter(([, v]) => v === true);
if (dangerous.length > 0) {
  await client.end();
  throw new Error(
    `Role ${ROLE} has privileged attributes (${dangerous
      .map(([k]) => k)
      .join(", ")}). rolbypassrls in particular would disable every tenant isolation policy. ` +
      `Drop the role and re-run, or fix it by hand as a superuser.`,
  );
}

await client.end();

// Rebuild the app connection string from the admin one: same host/project, but the restricted
// role and the TRANSACTION-mode pooler port, which is what short web requests should use.
const admin = new URL(adminUrl);
const tenantSuffix = decodeURIComponent(admin.username).split(".").slice(1).join(".");
const appUser = tenantSuffix ? `${ROLE}.${tenantSuffix}` : ROLE;
const isSupavisor = admin.hostname.endsWith("pooler.supabase.com");
const appUrl = `postgresql://${encodeURIComponent(appUser)}:${encodeURIComponent(password)}@${admin.hostname}:${
  isSupavisor ? 6543 : admin.port || 5432
}${admin.pathname}`;

// `--write-env` updates .env in place so the generated password never has to be copied through a
// terminal, a clipboard or a chat window on its way to the file it belongs in.
if (process.argv.includes("--write-env")) {
  const fs = await import("node:fs");
  const path = ".env";
  const existing = fs.existsSync(path) ? fs.readFileSync(path, "utf8") : "";
  const line = `APP_DATABASE_URL=${appUrl}`;
  const next = /^APP_DATABASE_URL=.*$/m.test(existing)
    ? existing.replace(/^APP_DATABASE_URL=.*$/m, line)
    : `${existing.replace(/\s*$/, "")}\n${line}\n`;
  fs.writeFileSync(path, next);
  console.log(`\nAPP_DATABASE_URL written to ${path} (role ${ROLE}, ${appUrl.length} chars).`);
  console.log("Set the same value in your deployment's environment variables.");
} else {
  console.log("\nAdd this to .env and to your deployment's environment variables:\n");
  console.log(`APP_DATABASE_URL=${appUrl}\n`);
  console.log("(re-run with --write-env to have it written to .env for you)");
}
if (isSupavisor) {
  console.log("(port 6543 = Supavisor transaction mode, the right pool for short web requests)");
}
