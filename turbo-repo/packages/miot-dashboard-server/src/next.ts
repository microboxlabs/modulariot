/**
 * @microboxlabs/miot-dashboard-server/next — mounting the API inside a Next
 * App Router route.
 *
 * Its own entry so a host that mounts in Next does not pull in the standalone
 * listener, and a standalone deployment does not pull in an adapter it never
 * calls. Nothing here imports `next` itself.
 */

export { createNextRouteHandlers } from "./adapters/next/route";
export type { NextRouteHandlers } from "./adapters/next/route";
export type { DashboardHandler, DashboardHandlerOptions } from "./http/handler";
