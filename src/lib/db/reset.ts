import process from "node:process";
import { Pool } from "pg";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }
  const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
  const pool = new Pool({ connectionString, ssl: isLocalHost ? undefined : { rejectUnauthorized: false } });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  await pool.end();
  console.log("Dropped and recreated the public schema.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
