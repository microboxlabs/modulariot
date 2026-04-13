import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

/**
 * Forward the caller's session JWT to a Quarkus endpoint and return the
 * raw response. Used by the admin UI's proxy routes
 * (`/api/admin/orgs/**`) to delegate auth + tenant scoping to Quarkus
 * without duplicating the authorization flow in Next.
 *
 * Supports read and write verbs. When {@code init.body} is provided the
 * upstream request is sent with {@code Content-Type: application/json}
 * and a serialized JSON body.
 *
 * - Returns a 401 when the caller is unauthenticated.
 * - Returns a 502 when the upstream is unreachable.
 * - Forwards the upstream status code verbatim for 4xx/5xx responses
 *   (so Quarkus's own 403 "not a member of org" / 400 "invalid tax id"
 *   reach the frontend).
 */
export async function forwardToQuarkus(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
  },
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
  const method = init?.method ?? "GET";
  let body: string | undefined;
  if (init?.body !== undefined) {
    body = JSON.stringify(init.body);
    headers["Content-Type"] = "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(15_000),
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

  // 204 No Content responses carry no body — return them as-is.
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseBody = await upstream.text();
  const contentType = upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(responseBody, {
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
