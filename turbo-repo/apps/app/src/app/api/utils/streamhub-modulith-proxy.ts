import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { getSharedAuthToken } from "@/app/api/utils/streamhub-api-client";
import { proxyToUpstream } from "@/app/api/utils/upstream-proxy";
import { modulithHost } from "@/lib/modulith-host";
import { sessionAuthHeader } from "@/features/auth/services/session-auth";
import { PLATFORM_SCOPE_SLUG } from "@/features/common/platform-scope";

const PLATFORM_ORG_PATH = `/api/v1/orgs/${PLATFORM_SCOPE_SLUG}/`;

/**
 * Proxy to the StreamHub-facing modulith API (GPS webhooks and future GPS
 * control-plane routes).
 *
 * Why a separate helper from {@code forwardToQuarkus}?
 * - Coordinator domain (orgs, WhatsApp, harness) uses {@code MIOT_MODULITH_URL}
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
 *   org checks when JWT azp/aud matches {@code org.tenantClientId}. Requests
 *   in the platform scope ({@code /api/v1/orgs/_platform/...}) always forward
 *   the session.
 *
 * Base URL resolution order:
 * 1. {@code MIOT_STREAMHUB_API_URL}
 * 2. fallback {@code MIOT_MODULITH_URL}
 */
export async function forwardToStreamhubModulith(
  path: string,
  init?: {
    method?: string;
    body?: unknown;
    /** Always forward the user's JWT, whatever {@code MIOT_STREAMHUB_AUTH} says. */
    sessionOnly?: boolean;
  }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl =
    process.env.MIOT_STREAMHUB_API_URL?.replace(/\/$/, "") ||
    modulithHost().replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      {
        error:
          "MIOT_STREAMHUB_API_URL (or MIOT_MODULITH_URL fallback) is not configured",
      },
      { status: 500 }
    );
  }

  // The modulith checks platform ownership from the token's email, which an M2M token does not carry.
  const headers = await buildHeaders(
    session,
    (init?.sessionOnly ?? false) || path.startsWith(PLATFORM_ORG_PATH)
  );
  return proxyToUpstream(baseUrl, path, headers, init, {
    upstreamErrorMessage: "Upstream StreamHub modulith request failed",
  });
}

async function buildHeaders(
  session: Session,
  sessionOnly: boolean
): Promise<Record<string, string>> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const mode = sessionOnly
    ? "session"
    : (process.env.MIOT_STREAMHUB_AUTH ?? "session").toLowerCase();

  if (mode === "m2m") {
    const token = await getSharedAuthToken().getToken();
    headers.Authorization = `Bearer ${token}`;
    return headers;
  }

  Object.assign(headers, sessionAuthHeader(session));
  if (session.user?.email) {
    headers["X-Dev-User-Email"] = session.user.email;
  }
  return headers;
}

/**
 * Relays a server-sent events stream from the StreamHub modulith with the
 * user's session. The upstream body is passed through as it arrives; the
 * upstream request ends when the browser disconnects (`signal`).
 */
export async function streamFromStreamhubModulith(
  path: string,
  signal: AbortSignal
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const baseUrl =
    process.env.MIOT_STREAMHUB_API_URL?.replace(/\/$/, "") ||
    modulithHost().replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { error: "MIOT_STREAMHUB_API_URL is not configured" },
      { status: 500 }
    );
  }
  const headers = await buildHeaders(session, true);
  const upstream = await fetch(`${baseUrl}${path}`, {
    headers: { ...headers, Accept: "text/event-stream" },
    cache: "no-store",
    signal,
  });
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: `Upstream stream failed: HTTP ${upstream.status}` },
      { status: upstream.status === 200 ? 502 : upstream.status }
    );
  }
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

const RELAYED_HEADERS = [
  "content-type",
  "content-length",
  "content-disposition",
  "cache-control",
  "x-content-type-options",
];

/**
 * Sends a request whose body is not JSON (a multipart upload) or whose answer
 * is a file, with the user's session, and passes the answer through as it is.
 */
export async function relayToStreamhubModulith(
  path: string,
  init: { method: string; body?: BodyInit }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const baseUrl =
    process.env.MIOT_STREAMHUB_API_URL?.replace(/\/$/, "") ||
    modulithHost().replace(/\/$/, "");
  if (!baseUrl) {
    return NextResponse.json(
      { error: "MIOT_STREAMHUB_API_URL is not configured" },
      { status: 500 }
    );
  }
  const headers = await buildHeaders(session, true);
  delete headers.Accept;
  const upstream = await fetch(`${baseUrl}${path}`, {
    method: init.method,
    headers,
    body: init.body,
    cache: "no-store",
  });
  const out = new Headers();
  for (const name of RELAYED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
