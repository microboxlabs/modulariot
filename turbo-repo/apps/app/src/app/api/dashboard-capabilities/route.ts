import { forwardDashboard } from "../dashboards/forward-dashboard";

export function GET(request: Request) {
  return forwardDashboard(request, undefined, "scopeCapabilities");
}
