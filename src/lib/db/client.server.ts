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
    pool = new Pool({
      connectionString,
      ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export function getDb() {
  return drizzle(getPool(), { schema });
}
