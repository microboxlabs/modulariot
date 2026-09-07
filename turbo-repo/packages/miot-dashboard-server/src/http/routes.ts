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

  // /scopes/{scopeId}/dashboards[/{slug}[/capabilities|permissions]]
  if (segments[0] !== "scopes" || segments[2] !== "dashboards") return null;

  const rawScope = segments[1];
  if (rawScope === undefined) return null;
  const scopeId = safeDecode(rawScope);
  if (scopeId === null || scopeId.length === 0) return null;

  if (segments.length === 3) return { route: "dashboards", scopeId };

  const rawSlug = segments[3];
  if (rawSlug === undefined) return null;
  const slug = safeDecode(rawSlug);
  if (slug === null || slug.length === 0) return null;

  if (segments.length === 4) return { route: "dashboard", scopeId, slug };

  if (segments.length === 5) {
    const tail = segments[4];
    if (tail === "capabilities")
      return { route: "capabilities", scopeId, slug };
    if (tail === "permissions") return { route: "permissions", scopeId, slug };
  }

  return null;
}

/** `decodeURIComponent` throws on a malformed sequence; a bad URL is not a crash. */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
