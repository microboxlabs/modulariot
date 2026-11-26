import {
  forwardDashboardFolders,
  type DashboardFolderRouteContext,
} from "../../../dashboards/forward-dashboard";

/** A folder's own permissions, apart from its dashboards'. */
export function GET(request: Request, context: DashboardFolderRouteContext) {
  return forwardDashboardFolders(request, context, "permissions");
}

export const PUT = GET;
