import { DashboardApiError } from "./error";

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
    [...value].some((character) => character.charCodeAt(0) <= 32) ||
    value.startsWith("//")
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
  return `${resource}${action === undefined ? "" : `/${action}`}${query}`;
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
