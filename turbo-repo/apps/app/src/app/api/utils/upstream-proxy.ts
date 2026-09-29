import "server-only";
import { NextResponse } from "next/server";

/**
 * Shared fetch + response mapping for Next → modulith proxies.
 * Callers supply base URL, path, headers, and optional body/method.
 */
export async function proxyToUpstream(
  baseUrl: string,
  path: string,
  headers: Record<string, string>,
  init?: {
    method?: string;
    body?: unknown;
    /** Dashboard revision precondition; never accepts arbitrary auth headers. */
    ifMatch?: string;
    signal?: AbortSignal;
  },
  options?: {
    /** Message used when the upstream fetch throws (network/timeout). */
    upstreamErrorMessage?: string;
  }
): Promise<NextResponse> {
  const method = init?.method ?? "GET";
  const requestHeaders = { ...headers };
  if (init?.ifMatch !== undefined) requestHeaders["If-Match"] = init.ifMatch;
  let body: string | undefined;
  if (init?.body !== undefined) {
    body = JSON.stringify(init.body);
    requestHeaders["Content-Type"] = "application/json";
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${baseUrl}${path}`, {
      method,
      headers: requestHeaders,
      body,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: options?.upstreamErrorMessage ?? "Upstream request failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 }
    );
  }

  const responseHeaders = new Headers({ "Cache-Control": "private, no-store" });
  const etag = upstream.headers.get("etag");
  if (etag !== null) responseHeaders.set("ETag", etag);
  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204, headers: responseHeaders });
  }

  let responseBody: string;
  try {
    responseBody = await upstream.text();
  } catch (err) {
    return NextResponse.json(
      {
        error: options?.upstreamErrorMessage ?? "Upstream request failed",
        details:
          err instanceof Error ? err.message : "Failed to read upstream body",
      },
      { status: 502 }
    );
  }

  const contentType =
    upstream.headers.get("content-type") ?? "application/json";

  responseHeaders.set("Content-Type", contentType);
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
