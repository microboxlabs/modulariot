import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getSharedAuthToken } from "@/app/api/utils/streamhub-api-client";

/**
 * Proxy to the StreamHub-facing modulith API (GPS webhooks and future GPS
 * control-plane routes).
 *
 * Why a separate helper from {@code forwardToQuarkus}?
 * - Coordinator domain (orgs, WhatsApp, harness) uses {@code MIOT_RESOURCE_URL}
 *   with the browser user's session JWT (RS256).
 * - StreamHub domain (GPS positions, symptoms, webhook subscriptions) may be
 *   a different host / cluster. Locally it often points at the same modulith;
 *   in production it can move to the StreamHub GKE cluster independently.
 *
 * Auth modes ({@code MIOT_STREAMHUB_AUTH}):
 * - {@code session} (default) — forward the logged-in user's JWT. Correct for
 *   Settings UI (OrganizationRequestFilter validates Alfresco membership).
 * - {@code m2m} — StreamHub client_credentials token (HS256, audience
 *   {@code STREAMHUB_AUDIENCE}). Useful for service probes; M2M only passes
 *   org checks when JWT azp/aud matches {@code org.tenantClientId}.
 *
 * Base URL resolution order:
 * 1. {@code MIOT_STREAMHUB_API_URL}
 * 2. fallback {@code MIOT_RESOURCE_URL}
 */
export async function forwardToStreamhubModulith(
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

  const baseUrl =
    process.env.MIOT_STREAMHUB_API_URL?.replace(/\/$/, "") ||
    process.env.MIOT_RESOURCE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          "MIOT_STREAMHUB_API_URL (or MIOT_RESOURCE_URL fallback) is not configured",
      },
      { status: 500 },
    );
  }

  const headers = await buildHeaders(session);
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
        error: "Upstream StreamHub modulith request failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 },
    );
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  const responseBody = await upstream.text();
  const contentType =
    upstream.headers.get("content-type") ?? "application/json";

  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, no-store",
    },
  });
}

async function buildHeaders(session: Session): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const mode = (process.env.MIOT_STREAMHUB_AUTH ?? "session").toLowerCase();

  if (mode === "m2m") {
    const token = await getSharedAuthToken().getToken();
    headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  const token = session.user?.rawJWT ?? session.user?.ticket;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (session.user?.email) {
    headers["X-Dev-User-Email"] = session.user.email;
  }
  return headers;
}
