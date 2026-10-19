import {
  forwardDashboard,
  type DashboardRouteContext,
} from "../forward-dashboard";

export function GET(request: Request, context: DashboardRouteContext) {
  return forwardDashboard(request, context);
}

export const PUT = GET;
export const DELETE = GET;
