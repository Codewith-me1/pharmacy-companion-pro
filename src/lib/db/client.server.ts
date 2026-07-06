import path from "node:path";
import process from "node:process";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

// Server-only. Never imported from client code (see config.server.ts convention).
let sqlite: Database.Database | undefined;

function getSqlite() {
  if (!sqlite) {
    const dbPath = process.env.DATABASE_PATH ?? path.join(process.cwd(), "mediOS.db");
    sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }
  return sqlite;
}

export function getDb() {
  return drizzle(getSqlite(), { schema });
}
