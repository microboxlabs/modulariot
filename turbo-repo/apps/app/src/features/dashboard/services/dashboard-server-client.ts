import {
  createDashboardClient,
  DashboardApiError,
} from "@microboxlabs/miot-dashboard-ui/client";

export { DashboardApiError } from "@microboxlabs/miot-dashboard-ui/client";

/** The app owns organization routing and same-origin session cookies. */
export function createDashboardServerClient(
  orgSlug: string,
  fetchImpl: typeof fetch = fetch
) {
  if (!orgSlug) throw new DashboardApiError(400);
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "/app";
  const query = `?org=${encodeURIComponent(orgSlug)}`;
  return createDashboardClient({
    routes: {
      dashboards: `${base}/api/dashboards${query}`,
      scopeCapabilities: `${base}/api/dashboard-capabilities${query}`,
    },
    fetch: fetchImpl,
    credentials: "same-origin",
  });
}
