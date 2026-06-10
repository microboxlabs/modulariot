/**
 * The app's PUBLIC origin, for building absolute redirects (e.g. to the
 * sign-in page) from a route handler.
 *
 * Behind the reverse proxy, the incoming request's origin is the container's
 * internal bind address (e.g. `http://0.0.0.0:3000`), so a redirect built from
 * it is unreachable by the browser. Resolution order:
 *  1. The configured NextAuth public URL (`AUTH_URL` / `NEXTAUTH_URL`) — not
 *     spoofable, and already required for NextAuth's basePath in any deployed
 *     environment.
 *  2. The reverse proxy's forwarded host/proto (the ingress sets these).
 *  3. The request origin — correct for local dev (e.g. `http://localhost:3050`).
 */
export function resolvePublicOrigin(request: Request): string {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  if (configured) {
    try {
      return new URL(configured).origin;
    } catch {
      // Malformed env value — fall through to proxy/header resolution.
    }
  }

  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  if (forwardedHost) {
    const forwardedProto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
      "https";
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}
