import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Forward the caller's session JWT to a Quarkus read endpoint and return the
 * raw JSON response. Used by the admin UI's read-only routes
 * (`/api/admin/orgs/{id}/members`, `/modules`, etc.) to proxy to the
 * equivalent Quarkus resources without duplicating the authorization flow.
 *
 * - Returns a 401 when the caller is unauthenticated.
 * - Returns a 502 when the upstream is unreachable.
 * - Forwards the upstream status code verbatim for 4xx responses (so
 *   Quarkus's own 403 "not a member of org" reaches the frontend).
 */
export async function forwardToQuarkus(
  path: string,
  init?: { method?: string },
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.MIOT_RESOURCE_URL;
  if (!baseUrl) {
    return NextResponse.json(
      { error: "MIOT_RESOURCE_URL is not configured" },
      { status: 500 },
    );
  }

  const headers = buildAuthHeaders(session);

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}${path}`, {
      method: init?.method ?? "GET",
      headers,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Upstream request failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 },
    );
  }

  const body = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  });
}

function buildAuthHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = session.user?.rawJWT ?? session.user?.ticket;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!session.user?.rawJWT && session.user?.email) {
    headers["X-Dev-User-Email"] = session.user.email;
  }
  return headers;
}
