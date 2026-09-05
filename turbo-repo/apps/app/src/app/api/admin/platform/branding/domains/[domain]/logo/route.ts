import { NextResponse } from "next/server";

import { auth } from "@/auth";
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
 * Upstream is the same public endpoint, so this exposes nothing that visiting
 * the domain would not. It still requires a session — an unauthenticated
 * caller has no business enumerating the platform's domains — and normalizes
 * the path parameter before interpolating it into the upstream URL.
 * `?variant=dark` selects the dark-background image; `?v=` is only a cache
 * buster and its value is not read.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ domain: string }> }
): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
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
      `${modulithHost()}/branding/${encodeURIComponent(normalized)}/logo${variant}`,
      { cache: "no-store", signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) }
    );
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  if (!upstream.ok) {
    return new NextResponse(null, {
      status: upstream.status === 404 ? 404 : 502,
    });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
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
