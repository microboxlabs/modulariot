import "server-only";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** `/api/v1/orgs/{slug}/{segments...}`, every segment encoded, plus an optional query. */
export function orgPath(
  slug: string,
  segments: readonly string[],
  query?: URLSearchParams
): string {
  const path = [slug, ...segments].map(encodeURIComponent).join("/");
  const base = `/api/v1/orgs/${path}`;
  const search = query?.toString();
  return search ? `${base}?${search}` : base;
}

/**
 * Only the named query parameters travel upstream, and only when their value
 * matches the rule. The caller's query string is never forwarded as-is.
 */
export function pickQuery(
  params: URLSearchParams,
  rules: Readonly<Record<string, RegExp>>
): URLSearchParams {
  const upstream = new URLSearchParams();
  for (const [key, rule] of Object.entries(rules)) {
    const value = params.get(key);
    if (value && rule.test(value)) upstream.set(key, value);
  }
  return upstream;
}

/**
 * Forwards to a path under the caller's active org with the session's token.
 * Ownership and sharing are decided upstream from the session identity.
 */
export async function forwardToOrg(
  segments: readonly string[],
  init?: { method?: string; body?: unknown; query?: URLSearchParams }
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;
  const { query, ...request } = init ?? {};
  return forwardToQuarkus(
    orgPath(result.scope.activeOrg.slug, segments, query),
    request
  );
}

export async function jsonBody(request: Request): Promise<unknown> {
  return request.json().catch(() => null);
}
