import { NextResponse } from "next/server";

import { domainFromHeaders } from "@/features/branding/request-domain";
import { isModulithConfigured, modulithHost } from "@/lib/modulith-host";

const UPSTREAM_TIMEOUT_MS = 5_000;

/** Copied verbatim so the browser gets the modulith's caching and the SVG
 * hardening it sets on the image. */
const FORWARDED_HEADERS = [
  "content-type",
  "etag",
  "cache-control",
  "x-content-type-options",
  "content-security-policy",
];

/**
 * Serves the branded logo for the host this request arrived on.
 *
 * A proxy rather than a direct link: the modulith is not reachable from the
 * browser, and routing through Next keeps the image on the app's own origin.
 * The domain comes from the request headers, never from the query string, so
 * the URL cannot be aimed at another host's branding. `?variant=dark` selects
 * the dark-background image, which is a property of the response and not of
 * who may see it; `?v=` is only a cache buster and its value is not read.
 */
export async function GET(request: Request): Promise<Response> {
  const domain = domainFromHeaders(request.headers);
  if (!domain || !isModulithConfigured()) {
    return new NextResponse(null, { status: 404 });
  }

  // Anything but the exact string "dark" is the light logo, so a stray value
  // cannot reach for a path segment upstream.
  const variant =
    new URL(request.url).searchParams.get("variant") === "dark" ? "/dark" : "";

  const ifNoneMatch = request.headers.get("if-none-match");
  let upstream: Response;
  try {
    upstream = await fetch(
      `${modulithHost()}/branding/${encodeURIComponent(domain)}/logo${variant}`,
      {
        headers: ifNoneMatch ? { "If-None-Match": ifNoneMatch } : {},
        cache: "no-store",
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      },
    );
  } catch {
    return new NextResponse(null, { status: 502 });
  }

  if (upstream.status === 304 || upstream.status === 404) {
    return new NextResponse(null, {
      status: upstream.status,
      headers: passThrough(upstream),
    });
  }
  if (!upstream.ok) {
    return new NextResponse(null, { status: 502 });
  }

  return new NextResponse(await upstream.arrayBuffer(), {
    status: 200,
    headers: passThrough(upstream),
  });
}

function passThrough(upstream: Response): Headers {
  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return headers;
}
