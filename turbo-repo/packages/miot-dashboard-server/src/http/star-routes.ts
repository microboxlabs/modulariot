/**
 * The star routes, split out of the handler like the folder routes. Each one
 * authorizes before it touches the store.
 *
 *   GET    /stars                   the caller's starred dashboards
 *   PUT    /dashboards/{slug}/star  star one
 *   DELETE /dashboards/{slug}/star  unstar it
 */

import type { AccessControl } from "../access/access-control";
import { DashboardServerError } from "../access/errors";
import type { DashboardStarStore } from "../seams/stars";
import { errorResponse, jsonResponse, noContentResponse } from "./responses";
import type { RouteMatch } from "./routes";

type Route = (request: Request, match: RouteMatch) => Promise<Response>;

export interface StarRouteOptions {
  access: AccessControl<Request>;
  /** Omitted: every star route answers 404. */
  stars: DashboardStarStore | undefined;
  /** The handler can serialize these writes with dashboard deletion. */
  atomic: boolean;
}

const notFound = () => DashboardServerError.notFound("No such endpoint");

export function createStarRoutes(
  options: StarRouteOptions,
): Record<"stars" | "dashboardStar", Route> {
  const { access } = options;

  /** 404 rather than 501, as for the other optional stores. */
  const requireStars = (): DashboardStarStore => {
    if (options.stars === undefined) throw notFound();
    return options.stars;
  };

  return {
    async stars(request, match) {
      const stars = requireStars();
      if (request.method.toUpperCase() !== "GET") {
        return errorResponse(notFound());
      }
      const decision = await access.authorize(request, {
        tenantId: match.tenantId,
        scopeId: match.scopeId,
        action: "star.list",
      });
      const data = await stars.list(
        { tenantId: decision.identity.tenantId, scopeId: match.scopeId },
        decision.identity.userId,
      );
      return jsonResponse({ data });
    },

    async dashboardStar(request, match) {
      const stars = requireStars();
      const method = request.method.toUpperCase();
      if (method !== "PUT" && method !== "DELETE") {
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
        action: "dashboard.star",
      });
      const scope = {
        tenantId: decision.identity.tenantId,
        scopeId: match.scopeId,
      };
      if (method === "DELETE") {
        // Unstarring a dashboard that is gone is still a success: the star
        // the caller wanted removed is not there.
        await stars.unstar(scope, decision.identity.userId, slug);
        return noContentResponse();
      }
      if (decision.dashboard?.record == null) {
        throw DashboardServerError.notFound("Dashboard not found");
      }
      if (!options.atomic) {
        throw DashboardServerError.badRequest(
          "Starring dashboards requires a store with scope transactions",
        );
      }
      await stars.star(scope, decision.identity.userId, slug);
      return noContentResponse();
    },
  };
}
