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
  },
  options?: {
    /** Message used when the upstream fetch throws (network/timeout). */
    upstreamErrorMessage?: string;
  },
): Promise<NextResponse> {
  const method = init?.method ?? "GET";
  const requestHeaders = { ...headers };
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
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: options?.upstreamErrorMessage ?? "Upstream request failed",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 502 },
    );
  }

  if (upstream.status === 204) {
    return new NextResponse(null, { status: 204 });
  }

  let responseBody: string;
  try {
    responseBody = await upstream.text();
  } catch (err) {
    return NextResponse.json(
      {
        error: options?.upstreamErrorMessage ?? "Upstream request failed",
        details: err instanceof Error ? err.message : "Failed to read upstream body",
      },
      { status: 502 },
    );
  }

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
