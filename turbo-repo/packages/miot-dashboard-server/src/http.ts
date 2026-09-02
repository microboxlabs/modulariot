/**
 * `@microboxlabs/miot-dashboard-server/http`
 *
 * The fetch-shaped HTTP layer: `Request` in, `Response` out, no listener and
 * no framework. Mount it in an existing server, or let the `server` entry wrap
 * it in a Node process.
 */

export {
  createDashboardHandler,
  type DashboardHandler,
  type DashboardHandlerOptions,
} from "./http/handler";

export { matchRoute, type RouteMatch, type RouteName } from "./http/routes";

export {
  errorResponse,
  jsonResponse,
  noContentResponse,
} from "./http/responses";
