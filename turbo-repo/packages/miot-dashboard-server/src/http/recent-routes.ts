/**
 * The recents routes, split out of the handler like the star routes. Each
 * one authorizes before it touches the store.
 *
 *   GET /recents                  the caller's latest opens, newest first
 *   PUT /dashboards/{slug}/open   note that the caller opened one
 */

import type { AccessControl } from "../access/access-control";
import { DashboardServerError } from "../access/errors";
import type { DashboardRecentStore } from "../seams/recents";
import { errorResponse, jsonResponse, noContentResponse } from "./responses";
import type { RouteMatch } from "./routes";

type Route = (request: Request, match: RouteMatch) => Promise<Response>;

export interface RecentRouteOptions {
  access: AccessControl<Request>;
  /** Omitted: every recents route answers 404. */
  recents: DashboardRecentStore | undefined;
}

/** How many opens a listing returns unless `?limit=` asks for fewer or more. */
export const DEFAULT_RECENTS_LIMIT = 12;
/** The most a listing returns, whatever `?limit=` asks. */
export const MAX_RECENTS_LIMIT = 500;

const notFound = () => DashboardServerError.notFound("No such endpoint");

/** `?limit=`, within 1 and the maximum; the default when absent. */
function limitOf(request: Request): number {
  const raw = new URL(request.url).searchParams.get("limit");
  if (raw === null) return DEFAULT_RECENTS_LIMIT;
  const limit = Number(raw);
  if (!Number.isInteger(limit) || limit < 1) {
    throw DashboardServerError.badRequest("limit must be a positive integer");
  }
  return Math.min(limit, MAX_RECENTS_LIMIT);
}

export function createRecentRoutes(
  options: RecentRouteOptions,
): Record<"recents" | "dashboardOpen", Route> {
  const { access } = options;

  /** 404 rather than 501, as for the other optional stores. */
  const requireRecents = (): DashboardRecentStore => {
    if (options.recents === undefined) throw notFound();
    return options.recents;
  };

  return {
    async recents(request, match) {
      const recents = requireRecents();
      if (request.method.toUpperCase() !== "GET") {
        return errorResponse(notFound());
      }
      const limit = limitOf(request);
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        action: "recent.list",
      });
      const data = await recents.list(
        { tenantId: decision.identity.tenantId, scopeId: match.scopeId },
        decision.identity.userId,
        limit,
      );
      return jsonResponse({ data });
    },

    async dashboardOpen(request, match) {
      const recents = requireRecents();
      if (request.method.toUpperCase() !== "PUT") {
        return errorResponse(notFound());
      }
      const slug = match.slug;
      if (slug === undefined) {
        throw DashboardServerError.badRequest("Missing dashboard slug");
      }
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        slug,
        action: "dashboard.open",
      });
      if (decision.dashboard?.record == null) {
        throw DashboardServerError.notFound("Dashboard not found");
      }
      await recents.record(
        { tenantId: decision.identity.tenantId, scopeId: match.scopeId },
        decision.identity.userId,
        slug,
      );
      return noContentResponse();
    },
  };
}
