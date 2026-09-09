/**
 * Path matching for the wire contract.
 *
 * Deliberately hand-written rather than pulled from a router library: the
 * surface is a handful of fixed shapes, and a dependency here would land in
 * every consumer of the core, including hosts that only wanted the services.
 */

export type RouteName =
  | "dashboards"
  | "dashboard"
  | "capabilities"
  | "permissions";

export interface RouteMatch {
  route: RouteName;
  /**
   * Named by the caller and worth nothing until the access control checks it.
   * It sits in the path rather than a header so that a log line, a cache key
   * and a shared link all say which tenant they mean.
   */
  tenantId: string;
  scopeId: string;
  /** Absent only for the collection route. */
  slug?: string;
}

/**
 * Match a pathname against the contract's routes.
 *
 * Segments are decoded, so a scope or slug containing a slash survives the
 * round trip as long as the caller percent-encoded it. Empty segments are
 * refused rather than treated as a wildcard.
 */
export function matchRoute(pathname: string): RouteMatch | null {
  const segments = pathname.split("/").filter((s) => s.length > 0);

  // /tenants/{tenantId}/scopes/{scopeId}/dashboards[/{slug}[/capabilities|permissions]]
  if (
    segments[0] !== "tenants" ||
    segments[2] !== "scopes" ||
    segments[4] !== "dashboards"
  ) {
    return null;
  }

  const tenantId = decodeSegment(segments[1]);
  if (tenantId === null) return null;
  const scopeId = decodeSegment(segments[3]);
  if (scopeId === null) return null;

  if (segments.length === 5) return { route: "dashboards", tenantId, scopeId };

  const slug = decodeSegment(segments[5]);
  if (slug === null) return null;

  if (segments.length === 6) {
    return { route: "dashboard", tenantId, scopeId, slug };
  }

  if (segments.length === 7) {
    const tail = segments[6];
    if (tail === "capabilities")
      return { route: "capabilities", tenantId, scopeId, slug };
    if (tail === "permissions")
      return { route: "permissions", tenantId, scopeId, slug };
  }

  return null;
}

/** A present, decodable, non-empty segment, or null. */
function decodeSegment(segment: string | undefined): string | null {
  if (segment === undefined) return null;
  const decoded = safeDecode(segment);
  return decoded === null || decoded.length === 0 ? null : decoded;
}

/** `decodeURIComponent` throws on a malformed sequence; a bad URL is not a crash. */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
