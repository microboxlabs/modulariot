import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { proxyToUpstream } from "@/app/api/utils/upstream-proxy";

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

  return proxyToUpstream(baseUrl, path, buildAuthHeaders(session), init);
}

function buildAuthHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = session.user?.rawJWT ?? session.user?.ticket;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (session.user?.email) {
    headers["X-Dev-User-Email"] = session.user.email;
  }
  return headers;
}
