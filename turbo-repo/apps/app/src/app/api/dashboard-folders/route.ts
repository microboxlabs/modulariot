import { forwardDashboardFolders } from "../dashboards/forward-dashboard";

export function GET(request: Request) {
  return forwardDashboardFolders(request);
}

export const POST = GET;
