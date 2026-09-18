import process from "node:process";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
  options?: { N?: number; r?: number; p?: number; maxmem?: number },
) => Promise<Buffer>;

const KEY_LENGTH = 64;

// Node's scrypt defaults (N=16384, r=8, p=1 — 16MB) are what the original hashes used. They are
// on the weak side of current guidance for password storage, so new hashes use a four-fold higher
// memory cost. 64MB per hash is the cost an attacker pays per guess on stolen data; it is also the
// cost this server pays per login, so it is bounded (~150-250ms) and overridable for a
// memory-constrained host via SCRYPT_COST_N.
const COST_N = Number(process.env.SCRYPT_COST_N) || 65536;
const PARAMS = { N: COST_N, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };

// Stored format: scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>
// The parameters are embedded so hashes written today stay verifiable after the cost is raised
// again — the alternative (a bare salt:hash, as the original used) silently breaks every existing
// password the moment the work factor changes.
const PREFIX = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, KEY_LENGTH, PARAMS);
  return `${PREFIX}$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    if (stored.startsWith(`${PREFIX}$`)) {
      const [, nStr, rStr, pStr, salt, hashHex] = stored.split("$");
      if (!salt || !hashHex) return false;
      const storedBuf = Buffer.from(hashHex, "hex");
      const derived = await scrypt(password, salt, storedBuf.length, {
        N: Number(nStr),
        r: Number(rStr),
        p: Number(pStr),
        maxmem: PARAMS.maxmem,
      });
      return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);
    }

    // Legacy "saltHex:hashHex" written with Node's scrypt defaults. Still accepted so existing
    // accounts keep working; login upgrades them in place (see needsRehash).
    const [salt, hashHex] = stored.split(":");
    if (!salt || !hashHex) return false;
    const storedBuf = Buffer.from(hashHex, "hex");
    const derived = await scrypt(password, salt, storedBuf.length);
    return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);
  } catch {
    // A malformed stored hash must read as "wrong password", never as a crash that leaks which
    // accounts have unusual records.
    return false;
  }
}

/** True when `stored` was written with weaker parameters than the current policy. */
export function needsRehash(stored: string): boolean {
  if (!stored.startsWith(`${PREFIX}$`)) return true;
  const n = Number(stored.split("$")[1]);
  return !Number.isFinite(n) || n < PARAMS.N;
}
