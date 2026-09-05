import { NextResponse } from "next/server";

import { quarkusAuthHeaders } from "@/app/api/utils/quarkus-proxy";
import { normalizeDomain } from "@/features/branding/domain-name";
import { isModulithConfigured, modulithHost } from "@/lib/modulith-host";

const UPSTREAM_TIMEOUT_MS = 5_000;

/**
 * GET /api/admin/platform/branding/domains/[domain]/logo — one domain's logo.
 *
 * The settings UI needs previews for domains other than the one the request
 * arrived on, which `/api/branding/logo` deliberately cannot serve: it reads
 * the domain from the request headers so the URL can never be aimed at
 * another host's branding.
 *
 * Upstream is the platform admin endpoint, not the public one, because the
 * public read serves only active domains — and this route is also how an edit
 * re-reads the bytes it must resend. Going through the public endpoint would
 * 404 for a deactivated domain and force a re-upload to change its link or
 * switch it back on, which is the opposite of what deactivating promises.
 * The modulith checks platform ownership; the caller's token is forwarded for
 * it to do so. The path parameter is normalized before interpolation.
 * `?variant=dark` selects the dark-background image; `?v=` is only a cache
 * buster and its value is not read.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
): Promise<Response> {
  const headers = await quarkusAuthHeaders();
  if (!headers) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { domain } = await params;
  const normalized = normalizeDomain(domain);
  if (!normalized || !isModulithConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  // Anything but the exact string "dark" is the light logo, so a stray value
  // cannot reach for a path segment upstream.
  const variant =
    new URL(request.url).searchParams.get("variant") === "dark" ? "/dark" : "";

  let upstream: Response;
  try {
    upstream = await fetch(
      `${modulithHost()}/api/v1/platform/branding/domains/${encodeURIComponent(normalized)}/logo${variant}`,
      {
        headers,
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      }
    );
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok) {
    // 401/403 are the modulith's answer about this caller, not a proxy fault,
    // so they are relayed rather than flattened into a 502.
    const relayed = [401, 403, 404];
    return new NextResponse(null, {
      status: relayed.includes(upstream.status) ? upstream.status : 502,
    });
  }

  // Read inside the guard: a body stream can fail after the headers arrive,
  // and an unhandled throw here would answer 500 instead of the 502 every
  // other upstream failure on this route produces.
  let body: ArrayBuffer;
  try {
    body = await upstream.arrayBuffer();
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") ?? "application/octet-stream",
      // An admin preview is per-user and changes as soon as it is replaced.
      "Cache-Control": "private, max-age=60",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
