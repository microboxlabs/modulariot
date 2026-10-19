import { forwardDashboard } from "./forward-dashboard";

export function GET(request: Request) {
  return forwardDashboard(request);
}
