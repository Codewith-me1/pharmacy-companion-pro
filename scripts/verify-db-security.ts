/**
 * Proves the production database posture actually holds. Run after any change to the database,
 * the connection settings or the roles — and in CI before a deploy:
 *
 *   npm run db:verify-security
 *
 * Every check is read-only or rolled back; nothing it does persists.
 */
import process from "node:process";
import net from "node:net";
import tls from "node:tls";
import { Client } from "pg";
import { sslConfigFor } from "../src/lib/db/ssl.server";
import { SUPABASE_ROOT_CA_2021_SHA256 } from "../src/lib/db/supabase-ca";

const appUrl = process.env.APP_DATABASE_URL;
if (!appUrl) throw new Error("APP_DATABASE_URL is not set.");

const failures: string[] = [];
const ok = (m: string) => console.log(`  [PASS] ${m}`);
const fail = (m: string) => {
  console.log(`  [FAIL] ${m}`);
  failures.push(m);
};

// ---------------------------------------------------------------- 1. transport
console.log("\n1. Transport security");
const parsed = new URL(appUrl);
{
  const sslConf = sslConfigFor(appUrl);
  if (sslConf && "rejectUnauthorized" in sslConf && sslConf.rejectUnauthorized === true) {
    ok("app connects with certificate verification enabled");
  } else {
    fail("app is NOT verifying the database server certificate");
  }

  // Walk the live chain and confirm the pinned root is still the one in play.
  const root = await new Promise<tls.DetailedPeerCertificate | null>((resolve) => {
    const sock = net.connect(Number(parsed.port || 5432), parsed.hostname, () => {
      const buf = Buffer.alloc(8);
      buf.writeInt32BE(8, 0);
      buf.writeInt32BE(80877103, 4); // postgres SSLRequest
      sock.write(buf);
    });
    sock.once("data", (d) => {
      if (d.toString() !== "S") return resolve(null);
      const t = tls.connect({ socket: sock, servername: parsed.hostname, rejectUnauthorized: false }, () => {
        let cur = t.getPeerCertificate(true);
        const seen = new Set<string>();
        while (cur.issuerCertificate && !seen.has(cur.fingerprint256)) {
          seen.add(cur.fingerprint256);
          if (cur.issuerCertificate.fingerprint256 === cur.fingerprint256) break;
          cur = cur.issuerCertificate;
        }
        resolve(cur);
        t.destroy();
      });
      t.on("error", () => resolve(null));
    });
    sock.on("error", () => resolve(null));
  });
  if (!root) fail("could not read the server certificate chain");
  else if (root.fingerprint256 === SUPABASE_ROOT_CA_2021_SHA256)
    ok(`server chain still roots in the pinned CA (${String(root.subject.CN)})`);
  else fail(`server root CA changed — pinned ${SUPABASE_ROOT_CA_2021_SHA256}, got ${root.fingerprint256}`);

  if (parsed.port === "6543") ok("app uses the transaction-mode pooler port (6543)");
  else console.log(`  [warn] app port is ${parsed.port} — 6543 (transaction mode) is preferred for web requests`);
}

const client = new Client({ connectionString: appUrl, ssl: sslConfigFor(appUrl) });
await client.connect();

// ---------------------------------------------------------------- 2. role privileges
console.log("\n2. Runtime role privileges");
{
  const r = (
    await client.query(
      `select current_user as who, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls, rolreplication
         from pg_roles where rolname = current_user`,
    )
  ).rows[0];
  if (r.who === "postgres") fail("app is connecting as the admin role 'postgres'");
  else ok(`app connects as restricted role '${r.who}'`);
  // rolbypassrls is the one that silently turns every tenant policy into a no-op.
  for (const attr of ["rolsuper", "rolbypassrls", "rolcreaterole", "rolcreatedb", "rolreplication"]) {
    if (r[attr]) fail(`runtime role has ${attr} = true`);
  }
  if (!r.rolsuper && !r.rolbypassrls) ok("runtime role cannot bypass Row-Level Security");
}

// ---------------------------------------------------------------- 3. RLS coverage
console.log("\n3. Row-Level Security coverage");
{
  const rows = (
    await client.query(
      `select c.relname as table,
              c.relrowsecurity as enabled,
              c.relforcerowsecurity as forced,
              (select count(*) from pg_policy p where p.polrelid = c.oid)::int as policies
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r'
        order by c.relname`,
    )
  ).rows as { table: string; enabled: boolean; forced: boolean; policies: number }[];

  // Deliberately global, i.e. not tenant-scoped, because each is consulted before a tenant
  // context exists (or belongs to tooling rather than to a pharmacy):
  //   users        — login has to find the account before it knows which tenant it is
  //   rate_limits  — brute-force counters are keyed by email/IP on unauthenticated requests
  //   __drizzle_migrations — drizzle-kit's own ledger
  // Anything NOT in this list must have RLS enabled, forced and policied.
  const GLOBAL = new Set(["users", "rate_limits", "__drizzle_migrations"]);
  const tenantTables = rows.filter((r) => !GLOBAL.has(r.table));
  const bad = tenantTables.filter((r) => !r.enabled || !r.forced || r.policies === 0);
  if (rows.length === 0) fail("no tables found — did migrations run?");
  else if (bad.length === 0) ok(`all ${tenantTables.length} tenant tables have RLS enabled, forced and policied`);
  else {
    for (const b of bad) fail(`${b.table}: enabled=${b.enabled} forced=${b.forced} policies=${b.policies}`);
  }
}

// ---------------------------------------------------------------- 4. real isolation proof
console.log("\n4. Cross-tenant isolation (inside a rolled-back transaction)");
try {
  await client.query("begin");
  const a = (
    await client.query(
      `insert into users (email, password_hash, name, created_at) values ($1,'x','A',now()::text) returning id`,
      [`verify-a-${Date.now()}@invalid.test`],
    )
  ).rows[0].id as number;
  const b = (
    await client.query(
      `insert into users (email, password_hash, name, created_at) values ($1,'x','B',now()::text) returning id`,
      [`verify-b-${Date.now()}@invalid.test`],
    )
  ).rows[0].id as number;

  await client.query(`select set_config('app.current_user_id', $1, true)`, [String(a)]);
  await client.query(`insert into suppliers (name, created_at) values ('ISOLATION PROBE A', now()::text)`);
  const seenByA = (await client.query(`select count(*)::int as n from suppliers`)).rows[0].n as number;

  await client.query(`select set_config('app.current_user_id', $1, true)`, [String(b)]);
  await client.query(`insert into suppliers (name, created_at) values ('ISOLATION PROBE B', now()::text)`);
  const seenByB = (await client.query(`select count(*)::int as n from suppliers`)).rows[0].n as number;

  if (seenByA === 1 && seenByB === 1) ok("each tenant sees only its own rows (1 and 1)");
  else fail(`tenant isolation leak: tenant A saw ${seenByA} rows, tenant B saw ${seenByB}`);

  // Writing a row explicitly stamped with someone else's owner_id must be refused by WITH CHECK.
  try {
    await client.query(`insert into suppliers (owner_id, name, created_at) values ($1, 'CROSS TENANT WRITE', now()::text)`, [a]);
    fail("a tenant was able to write a row owned by another tenant");
  } catch {
    ok("writing a row owned by another tenant is refused");
  }

  await client.query("rollback");
  ok("probe transaction rolled back — nothing persisted");
} catch (e) {
  await client.query("rollback").catch(() => {});
  fail(`isolation probe could not run: ${(e as Error).message.split("\n")[0]}`);
}

// ---------------------------------------------------------------- 5. no DDL from the app role
console.log("\n5. Schema is not writable by the app role");
try {
  await client.query("begin");
  await client.query("create table security_probe_should_fail (id int)");
  await client.query("rollback");
  fail("app role was able to CREATE TABLE — it should have no DDL rights");
} catch {
  await client.query("rollback").catch(() => {});
  ok("app role cannot create tables");
}

// ---------------------------------------------------------------- 6. statement timeout
console.log("\n6. Query timeouts");
{
  await client.query("begin");
  await client.query(`select set_config('statement_timeout','15s',true)`);
  const v = (await client.query(`show statement_timeout`)).rows[0].statement_timeout;
  await client.query("rollback");
  if (v === "15s") ok("transaction-local statement_timeout applies (15s)");
  else fail(`statement_timeout did not apply (got ${v})`);
}

await client.end();

console.log("\n" + "=".repeat(60));
if (failures.length === 0) {
  console.log("ALL CHECKS PASSED");
} else {
  console.log(`${failures.length} CHECK(S) FAILED:`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exitCode = 1;
}
