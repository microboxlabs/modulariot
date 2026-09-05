import { headers } from "next/headers";

import { normalizeDomain } from "@/features/branding/domain-name";

/**
 * The host the request arrived on, or null when it is absent or malformed.
 * The ingress sets `x-forwarded-host`; `host` covers local dev.
 */
export function domainFromHeaders(requestHeaders: Headers): string | null {
  const forwarded = requestHeaders.get("x-forwarded-host")?.split(",")[0];
  return normalizeDomain(forwarded ?? requestHeaders.get("host"));
}

export async function resolveRequestDomain(): Promise<string | null> {
  return domainFromHeaders(await headers());
}
