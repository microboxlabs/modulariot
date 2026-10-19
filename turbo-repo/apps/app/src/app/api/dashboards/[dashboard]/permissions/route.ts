import {
  forwardDashboard,
  type DashboardRouteContext,
} from "../../forward-dashboard";

export function GET(request: Request, context: DashboardRouteContext) {
  return forwardDashboard(request, context, "permissions");
}

export const PUT = GET;
