/**
 * Copies every row from the previous database into the Supabase one.
 *
 *   npm run db:migrate-data            # dry run: reports what would be copied
 *   npm run db:migrate-data -- --apply # actually copy
 *
 * Reads LEGACY_DATABASE_URL (source, read-only) and writes to DATABASE_URL (target, admin —
 * needed because Row-Level Security would otherwise reject rows belonging to other tenants).
 *
 * Primary keys are preserved so every foreign key still resolves, tables are copied in dependency
 * order worked out from the target's own catalog, the whole copy runs in ONE transaction (so a
 * failure leaves the target exactly as it was), and each table's id sequence is re-seeded
 * afterwards — miss that last step and the first insert from the UI collides with a copied row.
 */
import process from "node:process";
import { Client } from "pg";
import { sslConfigFor } from "../src/lib/db/ssl.server";

const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");

const sourceUrl = process.env.LEGACY_DATABASE_URL;
const targetUrl = process.env.DATABASE_URL;
if (!sourceUrl) throw new Error("LEGACY_DATABASE_URL is not set (the database to copy FROM).");
if (!targetUrl) throw new Error("DATABASE_URL is not set (the database to copy TO).");

const source = new Client({ connectionString: sourceUrl, ssl: sslConfigFor(sourceUrl) });
const target = new Client({ connectionString: targetUrl, ssl: sslConfigFor(targetUrl) });
await source.connect();
await target.connect();

// Order tables so a row is never inserted before the row it references. Self-references and the
// migration ledger are skipped.
async function dependencyOrder(client: Client): Promise<string[]> {
  const tables = (
    await client.query(
      `select tablename from pg_tables where schemaname = 'public' and tablename <> '__drizzle_migrations'`,
    )
  ).rows.map((r) => r.tablename as string);

  const deps = (
    await client.query(
      `select distinct tc.table_name as child, ccu.table_name as parent
         from information_schema.table_constraints tc
         join information_schema.constraint_column_usage ccu
           on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
        where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'`,
    )
  ).rows as { child: string; parent: string }[];

  const ordered: string[] = [];
  const pending = new Set(tables);
  while (pending.size > 0) {
    const ready = [...pending].filter((t) =>
      deps.every((d) => d.child !== t || d.parent === t || !pending.has(d.parent)),
    );
    if (ready.length === 0) {
      // A genuine cycle — fall back to catalog order rather than silently dropping tables.
      ordered.push(...pending);
      break;
    }
    ready.sort();
    ordered.push(...ready);
    for (const t of ready) pending.delete(t);
  }
  return ordered;
}

const order = await dependencyOrder(target);
const sourceTables = new Set(
  (await source.query(`select tablename from pg_tables where schemaname = 'public'`)).rows.map(
    (r) => r.tablename as string,
  ),
);

console.log(`copy order: ${order.join(" -> ")}\n`);

// Refuse to copy into a database that already holds data, unless explicitly forced: running this
// twice would duplicate every row and break the sequence re-seed.
const occupied: string[] = [];
for (const table of order) {
  const n = (await target.query(`select count(*)::int as n from "${table}"`)).rows[0].n as number;
  if (n > 0) occupied.push(`${table} (${n})`);
}
if (occupied.length > 0 && !FORCE) {
  console.error(`Target is not empty: ${occupied.join(", ")}`);
  console.error("Re-run with --force only if you intend to add to existing rows.");
  await source.end();
  await target.end();
  process.exit(1);
}

let grandTotal = 0;
const summary: { table: string; rows: number }[] = [];

if (APPLY) await target.query("begin");
try {
  for (const table of order) {
    if (!sourceTables.has(table)) {
      console.log(`${table.padEnd(22)} skipped (not present in the source database)`);
      continue;
    }

    // Only columns that exist on BOTH sides, so a schema that has moved on since does not break
    // the copy.
    const cols = (
      await Promise.all(
        [source, target].map(async (c) =>
          (
            await c.query(
              `select column_name from information_schema.columns
                where table_schema='public' and table_name=$1 order by ordinal_position`,
              [table],
            )
          ).rows.map((r) => r.column_name as string),
        ),
      )
    ).reduce((a, b) => a.filter((x) => b.includes(x)));

    const rows = (await source.query(`select ${cols.map((c) => `"${c}"`).join(", ")} from "${table}"`)).rows;
    summary.push({ table, rows: rows.length });
    grandTotal += rows.length;

    if (!APPLY || rows.length === 0) {
      console.log(`${table.padEnd(22)} ${String(rows.length).padStart(6)} rows`);
      continue;
    }

    // Chunked multi-row inserts: one round trip per 500 rows instead of per row, which matters
    // when the target is several thousand kilometres away.
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK);
      const params: unknown[] = [];
      const tuples = slice.map((row) => {
        const placeholders = cols.map((c) => {
          params.push((row as Record<string, unknown>)[c]);
          return `$${params.length}`;
        });
        return `(${placeholders.join(", ")})`;
      });
      await target.query(
        `insert into "${table}" (${cols.map((c) => `"${c}"`).join(", ")}) values ${tuples.join(", ")}`,
        params,
      );
    }
    console.log(`${table.padEnd(22)} ${String(rows.length).padStart(6)} rows copied`);
  }

  if (APPLY) {
    // Re-seed every serial sequence past the highest copied id.
    for (const table of order) {
      if (!sourceTables.has(table)) continue;
      await target.query(
        `select setval(pg_get_serial_sequence('public.${table}', 'id'),
                       coalesce((select max(id) from "${table}"), 1),
                       (select max(id) is not null from "${table}"))
           where pg_get_serial_sequence('public.${table}', 'id') is not null`,
      );
    }
    await target.query("commit");
    console.log(`\ncommitted — ${grandTotal} rows copied, id sequences re-seeded`);
  } else {
    console.log(`\nDRY RUN — ${grandTotal} rows would be copied. Re-run with --apply to do it.`);
  }
} catch (err) {
  if (APPLY) await target.query("rollback").catch(() => {});
  console.error("\nfailed, nothing was written:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await source.end();
  await target.end();
}
