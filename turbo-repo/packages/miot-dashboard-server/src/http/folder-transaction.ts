import type { AccessControl, DashboardAction } from "../access/access-control";
import type { DashboardFolderStore } from "../seams/folders";
import type { RouteMatch } from "./routes";

type Route = (request: Request, match: RouteMatch) => Promise<Response>;
const FOLDER_ROUTES = new Set<RouteMatch["route"]>([
  "folders",
  "folder",
  "folderPermissions",
  "dashboardFolder",
]);

const MUTATIONS: Partial<
  Record<RouteMatch["route"], Partial<Record<string, DashboardAction>>>
> = {
  dashboard: { PUT: "dashboard.save", DELETE: "dashboard.delete" },
  permissions: { PUT: "dashboard.permissions.write" },
  folders: { POST: "folder.write" },
  folder: { PATCH: "folder.write", DELETE: "folder.delete" },
  folderPermissions: { PUT: "folder.permissions.write" },
  dashboardFolder: { PUT: "dashboard.move" },
};

/** Authorize before locking; authorize again with the write under the scope lock. */
export function createScopedRouteRunner(options: {
  access: AccessControl<Request>;
  transaction: DashboardFolderStore["transaction"] | undefined;
  folders: DashboardFolderStore | undefined;
  readBody: (request: Request) => Promise<unknown>;
  routes: Record<RouteMatch["route"], Route>;
}): Route {
  return async (request, match) => {
    const route = options.routes[match.route];
    if (!options.folders && FOLDER_ROUTES.has(match.route))
      return route(request, match);
    const action = MUTATIONS[match.route]?.[request.method.toUpperCase()];
    if (!options.transaction || !action) return route(request, match);
    // Reject ineligible callers before touching the store or reading a body.
    const decision = await options.access.authorize(request, {
      tenantId: match.tenantId,
      scopeId: match.scopeId,
      ...(match.slug === undefined ? {} : { slug: match.slug }),
      action,
    });
    // A slow request stream must not hold a scope's write lock.
    if (request.method !== "DELETE") await options.readBody(request);
    return options.transaction(
      { tenantId: decision.identity.tenantId, scopeId: match.scopeId },
      () => route(request, match),
    );
  };
}
