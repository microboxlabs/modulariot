import {
  forwardDashboard,
  type DashboardRouteContext,
} from "../../forward-dashboard";

/** Stars the dashboard for the signed-in user; DELETE unstars it. */
export function PUT(request: Request, context: DashboardRouteContext) {
  return forwardDashboard(request, context, "star");
}

export const DELETE = PUT;
