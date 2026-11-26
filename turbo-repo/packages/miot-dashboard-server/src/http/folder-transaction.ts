import type {
  AccessControl,
  AccessDecision,
  DashboardAction,
} from "../access/access-control";
import type { DashboardFolderStore } from "../seams/folders";
import type { RouteMatch } from "./routes";
import type { AuditSink } from "../seams/audit";
import {
  isDashboardServerError,
  type DashboardServerError,
} from "../access/errors";
import { withVisibilitySnapshot } from "../access/visibility-snapshot";

type Route = (request: Request, match: RouteMatch) => Promise<Response>;
const FOLDER_ROUTES = new Set<RouteMatch["route"]>([
  "folders",
  "folder",
  "folderPermissions",
  "dashboardFolder",
]);

const SCOPED_ACTIONS: Partial<
  Record<RouteMatch["route"], Partial<Record<string, DashboardAction>>>
> = {
  dashboard: { PUT: "dashboard.save", DELETE: "dashboard.delete" },
  permissions: { PUT: "dashboard.permissions.write" },
  folders: { POST: "folder.write" },
  folder: { PATCH: "folder.write", DELETE: "folder.delete" },
  folderPermissions: {
    GET: "folder.permissions.read",
    PUT: "folder.permissions.write",
  },
  dashboardFolder: { PUT: "dashboard.move" },
};

/** Authorize before locking; authorize again with the write under the scope lock. */
export function createScopedRouteRunner(options: {
  access: AccessControl<Request>;
  audit?: AuditSink;
  now?: () => Date;
  onAuditError?: (error: unknown) => void;
  transaction: DashboardFolderStore["transaction"] | undefined;
  folders: DashboardFolderStore | undefined;
  readBody: (request: Request) => Promise<unknown>;
  routes: Record<RouteMatch["route"], Route>;
}): Route {
  async function auditDenial(
    decision: AccessDecision,
    action: DashboardAction,
    match: RouteMatch,
    error: DashboardServerError,
  ): Promise<void> {
    try {
      await options.audit?.record({
        at: (options.now?.() ?? new Date()).toISOString(),
        tenantId: decision.identity.tenantId,
        userId: decision.identity.userId,
        action,
        target: `${match.scopeId}/${match.id ?? match.slug ?? ""}`,
        outcome: "denied",
        detail: {
          reason: error.reason ?? error.code,
          ...(decision.identity.asserted ? { asserted: true } : {}),
        },
      });
    } catch (auditError) {
      options.onAuditError?.(auditError);
    }
  }

  return async (request, match) => {
    const route = options.routes[match.route];
    if (!options.folders && FOLDER_ROUTES.has(match.route))
      return route(request, match);
    const action = SCOPED_ACTIONS[match.route]?.[request.method.toUpperCase()];
    if (!options.transaction || !action) return route(request, match);
    // Reject ineligible callers before touching the store or reading a body.
    const decision = await options.access.authorize(request, {
      tenantId: match.tenantId,
      scopeId: match.scopeId,
      ...(match.slug === undefined ? {} : { slug: match.slug }),
      action,
    });
    // A slow request stream must not hold a scope's write lock.
    if (!["DELETE", "GET"].includes(request.method))
      await options.readBody(request);
    try {
      return await options.transaction(
        { tenantId: decision.identity.tenantId, scopeId: match.scopeId },
        () => withVisibilitySnapshot(() => route(request, match)),
      );
    } catch (error) {
      if (
        FOLDER_ROUTES.has(match.route) &&
        isDashboardServerError(error) &&
        [403, 404].includes(error.status)
      ) {
        await auditDenial(decision, action, match, error);
      }
      throw error;
    }
  };
}
