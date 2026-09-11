/**
 * Mounting the API inside a Next App Router route.
 *
 * There is deliberately no `next` import here. The handler is already
 * fetch-shaped — `(Request) => Promise<Response>` is exactly what an App
 * Router route exports — so an adapter that reached for Next's types would
 * add a peer dependency and buy nothing. What this does add is the part hosts
 * get wrong: naming every method the API answers, so a route file cannot
 * quietly omit one, and refusing a `basePath` that does not match where the
 * route is actually mounted.
 *
 * ```ts
 * // app/api/dashboards/[...path]/route.ts
 * export const runtime = "nodejs";
 * export const { GET, PUT, DELETE, OPTIONS } = createNextRouteHandlers({
 *   basePath: "/api/dashboards",
 *   identity, tenants, scopes, store,
 *   // A host rule that only ever takes access away, e.g. the `allowedGroups`
 *   // audience an existing config already carries. Optional; the key is
 *   // `policy`, not `capabilities`.
 *   policy: createAllowedGroupsPolicy(),
 *   // Absent, no `Access-Control-*` header is set and a preflight has no
 *   // answer — which reads as a broken endpoint rather than a missing option.
 *   cors: { origins: ["https://app.example"] },
 * });
 * ```
 *
 * `runtime = "nodejs"` is the host's line to write, and it is not optional:
 * the stores this package ships use `node:sqlite` or `pg`, neither of which
 * exists on the edge runtime.
 */

import {
  createDashboardHandler,
  type DashboardHandler,
  type DashboardHandlerOptions,
} from "../../http/handler";

/**
 * Every method the API answers. A route file exporting fewer gets 405 from
 * Next for the rest, which reads as "this endpoint is broken" rather than
 * "this route was mounted wrong".
 *
 * `OPTIONS` is here for CORS preflight. Without it Next answers preflight
 * itself, and a browser is told the request is not allowed for reasons no
 * amount of configuration will explain.
 */
export interface NextRouteHandlers {
  GET: DashboardHandler;
  PUT: DashboardHandler;
  DELETE: DashboardHandler;
  OPTIONS: DashboardHandler;
}

export function createNextRouteHandlers(
  options: DashboardHandlerOptions,
): NextRouteHandlers {
  const handler = createDashboardHandler(options);
  // One handler behind all four: the package routes on method itself, and
  // giving each export its own closure would only create the chance for them
  // to be built from different options.
  return {
    GET: handler,
    PUT: handler,
    DELETE: handler,
    OPTIONS: handler,
  };
}
