import process from "node:process";

/**
 * Response headers applied to everything the server returns (see src/server.ts).
 *
 * These are the browser-side half of the security posture: the database work stops one pharmacy
 * reading another's rows, but nothing there prevents this app being framed by a phishing page,
 * having a stray script exfiltrate a logged-in session, or being downgraded to http on a hostile
 * network. Each header below closes one of those.
 */

const isProduction = process.env.NODE_ENV === "production";

// Kept deliberately narrow — the client bundle loads no third-party scripts, fonts, styles or
// XHR targets (verified against src/routes, src/components and styles.css), so anything reaching
// for an outside origin at runtime is not this application.
//
// 'unsafe-inline' for script-src is unavoidable here: the SSR framework inlines its hydration
// payload in a <script> tag with no nonce, so removing it would break the app on first paint.
// It still blocks the more valuable case — pulling executable code from an attacker's domain.
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  // Tailwind and React inline style attributes.
  "style-src 'self' 'unsafe-inline'",
  // data:/blob: cover invoice photos held in memory before upload and generated previews.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  // The print/report windows are written via document.write from this origin.
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // Stops this app being embedded in someone else's page and clickjacked.
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

export function securityHeaders(requestUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    // Never let a browser second-guess a declared content type (the classic way a stored file
    // becomes stored script).
    "x-content-type-options": "nosniff",
    // frame-ancestors above supersedes this for modern browsers; kept for older ones.
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    // No part of a pharmacy till needs these.
    "permissions-policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "cross-origin-opener-policy": "same-origin",
    "x-dns-prefetch-control": "off",
  };

  // Only meaningful over TLS, and setting it from a local http dev server would pin localhost to
  // https in the developer's browser for two years.
  if (requestUrl.startsWith("https://")) {
    headers["strict-transport-security"] = "max-age=63072000; includeSubDomains";
  }

  // The dev server needs websocket connections and eval for HMR, which the production policy
  // forbids; applying it locally would break hot reload without improving production safety.
  if (isProduction) {
    headers["content-security-policy"] = CSP_DIRECTIVES;
  }

  return headers;
}

/**
 * Returns a Response carrying the security headers. Responses produced by `fetch` have immutable
 * headers, so fall back to rebuilding the response (streaming body preserved) if setting throws.
 */
export function withSecurityHeaders(response: Response, requestUrl: string): Response {
  const headers = securityHeaders(requestUrl);
  try {
    for (const [name, value] of Object.entries(headers)) {
      if (!response.headers.has(name)) response.headers.set(name, value);
    }
    return response;
  } catch {
    const merged = new Headers(response.headers);
    for (const [name, value] of Object.entries(headers)) {
      if (!merged.has(name)) merged.set(name, value);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: merged,
    });
  }
}
