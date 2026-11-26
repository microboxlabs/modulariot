import { forwardDashboard } from "../dashboards/forward-dashboard";

/** The signed-in user's starred dashboards in the active organization. */
export function GET(request: Request) {
  return forwardDashboard(request, undefined, "stars");
}
