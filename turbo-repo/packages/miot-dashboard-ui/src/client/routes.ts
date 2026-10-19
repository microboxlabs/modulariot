import { DashboardApiError } from "./error";

function hasDotPathSegment(endpoint: string): boolean {
  const pathAndOrigin = endpoint.split("?")[0] ?? "";
  const start = endpoint.startsWith("/")
    ? 0
    : pathAndOrigin.indexOf("/", endpoint.indexOf("://") + 3);
  if (start < 0) return false;
  return pathAndOrigin
    .slice(start)
    .split("/")
    .some((segment) => {
      const decoded = segment.replaceAll(/%2e/gi, ".");
      return decoded === "." || decoded === "..";
    });
}

export function pathSegment(value: string): string {
  if (
    !value ||
    value.split("/").some((part) => part === "." || part === "..")
  ) {
    throw new DashboardApiError(400);
  }
  return encodeURIComponent(value);
}

/** Reject URL forms that could silently change the host or drop a route suffix. */
export function validateEndpoint(value: string): void {
  if (
    !value ||
    value.includes("\\") ||
    value.includes("#") ||
    [...value].some((character) => character <= " ") ||
    value.startsWith("//") ||
    hasDotPathSegment(value)
  ) {
    throw new DashboardApiError(400);
  }
  try {
    const parsed = new URL(value, "https://dashboard.invalid");
    const explicitHttp =
      value.startsWith("https://") || value.startsWith("http://");
    if (
      !(value.startsWith("/") || explicitHttp) ||
      parsed.username ||
      parsed.password
    ) {
      throw new DashboardApiError(400);
    }
  } catch {
    throw new DashboardApiError(400);
  }
}

export function appendRoute(
  base: string,
  slug?: string,
  action?: string,
): string {
  const queryIndex = base.indexOf("?");
  const path = queryIndex < 0 ? base : base.slice(0, queryIndex);
  const query = queryIndex < 0 ? "" : base.slice(queryIndex);
  const prefix = path.endsWith("/") ? path.slice(0, -1) : path;
  const resource =
    slug === undefined ? prefix : `${prefix}/${pathSegment(slug)}`;
  const suffix = action === undefined ? "" : `/${action}`;
  return `${resource}${suffix}${query}`;
}

/** Build routes for a standalone server, including any host-owned URL prefix. */
export function createDashboardRoutes(options: {
  baseUrl: string;
  tenantId: string;
  scopeId: string;
}) {
  validateEndpoint(options.baseUrl);
  if (options.baseUrl.includes("?")) throw new DashboardApiError(400);
  const scope = appendRoute(
    options.baseUrl,
    undefined,
    `tenants/${pathSegment(options.tenantId)}/scopes/${pathSegment(options.scopeId)}`,
  );
  return {
    dashboards: `${scope}/dashboards`,
    scopeCapabilities: `${scope}/capabilities`,
  };
}
