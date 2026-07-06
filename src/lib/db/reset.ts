import fs from "node:fs";
import process from "node:process";

const dbPath = process.env.DATABASE_PATH ?? "mediOS.db";
for (const suffix of ["", "-wal", "-shm"]) {
  fs.rmSync(dbPath + suffix, { force: true });
}
console.log(`Removed ${dbPath} (and WAL/SHM files if present).`);
