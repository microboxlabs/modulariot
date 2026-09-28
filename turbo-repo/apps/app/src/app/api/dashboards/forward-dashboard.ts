import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { orgPath } from "@/app/api/utils/org-proxy";

export type DashboardRouteContext = {
  params: Promise<{ dashboard: string }>;
};

/** Active-org selection and session authentication stay on the server. */
export async function forwardDashboard(
  request: Request,
  context?: DashboardRouteContext,
  action?: "capabilities" | "permissions"
) {
  const tenant = await resolveTenantScope();
  if (!tenant.resolved) return tenant.response;
  const segments = ["dashboards"];
  if (context) {
    const { dashboard } = await context.params;
    // URL normalizers resolve dot segments even after percent encoding.
    if (
      !dashboard ||
      dashboard.split("/").some((part) => part === "." || part === "..")
    ) {
      return NextResponse.json(
        { error: "Invalid dashboard identifier" },
        { status: 400 }
      );
    }
    segments.push(dashboard);
  }
  if (action) segments.push(action);
  let body: unknown;
  if (request.method === "PUT") {
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Request body must be valid JSON" },
        { status: 400 }
      );
    }
  }
  return forwardToQuarkus(orgPath(tenant.scope.activeOrg.slug, segments), {
    method: request.method,
    body,
    ifMatch: request.headers.get("if-match") ?? undefined,
  });
}
