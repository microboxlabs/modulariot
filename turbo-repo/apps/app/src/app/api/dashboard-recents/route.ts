import { forwardDashboard } from "../dashboards/forward-dashboard";

/** The dashboards the signed-in user opened lately in the active organization. */
export function GET(request: Request) {
  return forwardDashboard(request, undefined, "recents");
}
