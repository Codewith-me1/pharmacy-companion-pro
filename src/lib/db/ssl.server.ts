import process from "node:process";
import tls from "node:tls";
import { SUPABASE_ROOT_CA_2021 } from "./supabase-ca";

/**
 * TLS settings for a Postgres connection string.
 *
 * The app previously connected with `rejectUnauthorized: false`, which encrypts the connection but
 * verifies nothing: anything that can intercept the TCP session can present its own certificate,
 * read every query and the database credentials, and rewrite results. For a system holding
 * patient-adjacent sales records and drug-licence details that is not an acceptable production
 * posture, so connections are now fully verified.
 *
 * The trust store is Supabase's root CA *plus* Node's bundled public roots, so the same code path
 * verifies Supabase (whose certificates chain to their own root) and any publicly-signed provider
 * (Neon, RDS, Aiven, …) without per-provider configuration.
 */
export function sslConfigFor(connectionString: string): tls.ConnectionOptions | undefined {
  // Local Docker/native Postgres has no TLS configured at all and rejects a TLS handshake.
  const isLocalHost = /(^|@)(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
  if (isLocalHost) return undefined;

  // Deliberate, explicit escape hatch for a provider whose CA is neither public nor bundled here.
  // Refused in production: silently downgrading to an unauthenticated connection is exactly the
  // failure this module exists to prevent.
  if (process.env.DATABASE_SSL_INSECURE === "true") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "DATABASE_SSL_INSECURE=true is not allowed in production — it disables server certificate " +
          "verification and exposes the database connection to man-in-the-middle interception.",
      );
    }
    console.warn(
      "[DB TLS] certificate verification DISABLED via DATABASE_SSL_INSECURE — development only.",
    );
    return { rejectUnauthorized: false };
  }

  return {
    ca: [SUPABASE_ROOT_CA_2021, ...tls.rootCertificates],
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  };
}
