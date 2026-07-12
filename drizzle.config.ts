import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "postgres://postgres:mediospass@localhost:5433/mediOS";
const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(url);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url,
    ssl: isLocalHost ? undefined : { rejectUnauthorized: false },
  },
});
