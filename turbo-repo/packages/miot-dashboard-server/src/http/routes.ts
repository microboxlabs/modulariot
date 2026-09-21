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
  | "permissions"
  | "datasources"
  | "datasource"
  | "credentials"
  | "credential";

export interface RouteMatch {
  route: RouteName;
  /**
   * Named by the caller and worth nothing until the access control checks it.
   * It sits in the path rather than a header so that a log line, a cache key
   * and a shared link all say which tenant they mean.
   */
  tenantId: string;
  /**
   * Present on every route. Datasources and credentials belong to the
   * tenant, but a role is granted per scope, so authorizing one still needs
   * the scope the caller is acting in.
   */
  scopeId: string;
  /** Absent only for the collection route. */
  slug?: string;
  /** Datasource id or credential ref, on the routes that address one. */
  id?: string;
}

/**
 * Match a pathname against the contract's routes.
 *
 * Segments are decoded, so a scope or slug containing a slash survives the
 * round trip as long as the caller percent-encoded it. A decoded value is
 * refused when it is empty, or when it holds a `.` or `..` component — an
 * identifier this hands back has to survive being put in a URL again.
 */
export function matchRoute(pathname: string): RouteMatch | null {
  const segments = pathname.split("/").filter((s) => s.length > 0);

  // /tenants/{tenantId}/scopes/{scopeId}/<collection>[/{id}[/<action>]]
  if (segments[0] !== "tenants" || segments[2] !== "scopes") return null;

  const tenantId = decodeSegment(segments[1]);
  if (tenantId === null) return null;
  const scopeId = decodeSegment(segments[3]);
  if (scopeId === null) return null;

  const collection = segments[4];
  if (collection === "datasources") {
    return matchDataSources(segments, tenantId, scopeId);
  }
  if (collection === "credentials") {
    return matchCredentials(segments, tenantId, scopeId);
  }
  if (collection !== "dashboards") return null;

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

/** /datasources, /datasources/{id} */
function matchDataSources(
  segments: readonly string[],
  tenantId: string,
  scopeId: string,
): RouteMatch | null {
  if (segments.length === 5) return { route: "datasources", tenantId, scopeId };

  const id = decodeSegment(segments[5]);
  if (id === null) return null;

  if (segments.length === 6) {
    return { route: "datasource", tenantId, scopeId, id };
  }
  return null;
}

/** /credentials, /credentials/{ref} */
function matchCredentials(
  segments: readonly string[],
  tenantId: string,
  scopeId: string,
): RouteMatch | null {
  if (segments.length === 5) return { route: "credentials", tenantId, scopeId };

  const id = decodeSegment(segments[5]);
  if (id === null) return null;
  if (segments.length === 6) {
    return { route: "credential", tenantId, scopeId, id };
  }
  return null;
}

/** A present, decodable, non-empty, non-traversing segment, or null. */
function decodeSegment(segment: string | undefined): string | null {
  if (segment === undefined) return null;
  const decoded = safeDecode(segment);
  if (decoded === null || decoded.length === 0) return null;
  // A slash inside a decoded segment is deliberate above, which is what makes
  // `..` reachable here. An identifier the server hands back in a listing has
  // to survive being put back into a URL: a client that builds one from
  // "../../escape" has it normalized to a different resource before the
  // request is even sent, and the store would have accepted the name.
  if (decoded.split("/").some((part) => part === "." || part === "..")) {
    return null;
  }
  return decoded;
}

/** `decodeURIComponent` throws on a malformed sequence; a bad URL is not a crash. */
function safeDecode(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
