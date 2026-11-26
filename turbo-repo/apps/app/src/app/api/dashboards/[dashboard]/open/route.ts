import {
  forwardDashboard,
  type DashboardRouteContext,
} from "../../forward-dashboard";

/** Notes that the signed-in user opened the dashboard, for their recents. */
export function PUT(request: Request, context: DashboardRouteContext) {
  return forwardDashboard(request, context, "open");
}
