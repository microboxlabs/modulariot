import {
  forwardDashboard,
  type DashboardRouteContext,
} from "../../forward-dashboard";

/** Files the dashboard in a folder: `{ folderId: string | null }`. */
export function PUT(request: Request, context: DashboardRouteContext) {
  return forwardDashboard(request, context, "folder");
}
