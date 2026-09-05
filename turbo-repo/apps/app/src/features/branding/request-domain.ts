import { headers } from "next/headers";

const MAX_DOMAIN_LENGTH = 253;
const MAX_LABEL_LENGTH = 63;

/**
 * Normalizes a host into the spelling the modulith stores in
 * `domain_branding.domain`. Mirrors `DomainName.normalize` on the Java side:
 * lookups are exact string matches, so both ends have to agree on one form.
 *
 * Returns null rather than throwing — a request on an unexpected host should
 * fall back to the default logo, not fail the render. Rejecting instead of
 * passing the value through also keeps a hostile `Host` header out of the URL
 * path the domain is interpolated into.
 */
export function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();

  // A Host header may carry the port; branding does not vary by port. Only a
  // numeric suffix counts as one, so "https://host" is rejected below rather
  // than truncated to the single label "https".
  const colon = value.indexOf(":");
  if (colon >= 0) {
    if (!/^\d{1,5}$/.test(value.slice(colon + 1))) return null;
    value = value.slice(0, colon);
  }
  // "example.com." and "example.com" are the same name.
  if (value.endsWith(".")) value = value.slice(0, -1);

  if (value.length === 0 || value.length > MAX_DOMAIN_LENGTH) return null;
  return value.split(".").every(isLabel) ? value : null;
}

function isLabel(label: string): boolean {
  return (
    label.length > 0 &&
    label.length <= MAX_LABEL_LENGTH &&
    !label.startsWith("-") &&
    !label.endsWith("-") &&
    /^[a-z0-9-]+$/.test(label)
  );
}

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
