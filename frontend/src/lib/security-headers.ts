/** Build Content-Security-Policy for App Router (nonce per request via middleware). */

function apiConnectSources(): string {
  const out = new Set(["'self'"]);
  const api = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";
  try {
    const { protocol, host } = new URL(api);
    out.add(`${protocol}//${host}`);
  } catch {
    /* ignore */
  }
  if (process.env.NODE_ENV !== "production") {
    out.add("http://localhost:4000");
    out.add("http://127.0.0.1:4000");
    out.add("ws://localhost:3000");
    out.add("ws://127.0.0.1:3000");
  }
  return [...out].join(" ");
}

export function buildContentSecurityPolicy(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`;

  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    `connect-src ${apiConnectSources()}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export const STATIC_SECURITY_HEADERS: Record<string, string> = {
  "X-DNS-Prefetch-Control": "on",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains; preload",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
};
