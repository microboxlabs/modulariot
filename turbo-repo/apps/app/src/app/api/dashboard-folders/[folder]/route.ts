import {
  forwardDashboardFolders,
  type DashboardFolderRouteContext,
} from "../../dashboards/forward-dashboard";

export function PATCH(request: Request, context: DashboardFolderRouteContext) {
  return forwardDashboardFolders(request, context);
}

export const DELETE = PATCH;
