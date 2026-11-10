import "server-only";
import { auth } from "@/auth";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { proxyToUpstream } from "@/app/api/utils/upstream-proxy";
import { modulithHost } from "@/lib/modulith-host";
import { sessionAuthHeader } from "@/features/auth/services/session-auth";
import { logger } from "@/lib/logger";

/**
 * Proxy to the modulith that holds the GPS data (positions, symptoms, webhook
 * subscriptions), with the logged-in user's session token.
 *
 * Base URL: {@code MIOT_STREAMHUB_API_URL}, else {@code MIOT_MODULITH_URL}.
 */
export async function forwardToStreamhubModulith(
  path: string,
  init?: { method?: string; body?: unknown }
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

  return proxyToUpstream(baseUrl, path, sessionHeaders(session), init, {
    upstreamErrorMessage:
      "Content service is temporarily unavailable. Please try again.",
  });
}

function sessionHeaders(session: Session): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    ...sessionAuthHeader(session),
  };
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
  const headers = sessionHeaders(session);
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
  "content-security-policy",
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
  const headers = sessionHeaders(session);
  delete headers.Accept;
  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}${path}`, {
      method: init.method,
      headers,
      body: init.body,
      cache: "no-store",
    });
  } catch (err) {
    logger.error({ err }, "StreamHub modulith content relay failed");
    return NextResponse.json(
      {
        error: "Content service is temporarily unavailable. Please try again.",
      },
      { status: 502 }
    );
  }
  const out = new Headers();
  for (const name of RELAYED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) out.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status, headers: out });
}
