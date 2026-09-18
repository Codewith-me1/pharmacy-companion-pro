import process from "node:process";
import { defineConfig } from "drizzle-kit";
import { sslConfigFor } from "./src/lib/db/ssl.server";

// drizzle-kit does not read .env itself, and the npm scripts invoke it directly (no tsx
// --env-file wrapper), so load it here. Node 20.6+ ships loadEnvFile; a missing file is fine
// because CI/deployment environments inject these as real environment variables instead.
try {
  process.loadEnvFile?.(".env");
} catch {
  /* no .env on disk — rely on the real environment */
}

// Migrations run as the admin role (DATABASE_URL) because they create tables, policies and
// defaults that the restricted runtime role is deliberately not allowed to touch. Point this at
// Supabase's SESSION-mode pooler (port 5432) — the transaction-mode port (6543) is for the app's
// short transactions and does not support the session-level operations DDL tooling relies on.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set — add it to .env before running drizzle-kit.");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
    // Same verified-TLS policy as the running app: the migration connection carries admin
    // credentials, so it is the last place that should accept an unverified certificate.
    ssl: sslConfigFor(url),
  },
});
