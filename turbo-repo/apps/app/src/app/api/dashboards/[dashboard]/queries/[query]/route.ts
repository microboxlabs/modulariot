import {
  forwardDashboard,
  type DashboardRouteContext,
} from "../../../forward-dashboard";

export async function POST(request: Request, context: DashboardRouteContext) {
  return forwardDashboard(request, context, "query");
}
