import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { orgPath } from "@/app/api/utils/org-proxy";

export type DashboardRouteContext = {
  params: Promise<{ dashboard: string; query?: string }>;
};

function isSafeIdentifier(value: string | undefined): value is string {
  return !!value && !value.split("/").some((part) => part === "." || part === "..");
}

/** Active-org selection and session authentication stay on the server. */
export async function forwardDashboard(
  request: Request,
  context?: DashboardRouteContext,
  action?: "capabilities" | "permissions" | "query" | "scopeCapabilities"
) {
  const tenant = await resolveTenantScope();
  if (!tenant.resolved) return tenant.response;
  // A tab opened in one organization must not save into another after a switch.
  const expectedOrg = new URL(request.url).searchParams.get("org");
  if (expectedOrg !== null && expectedOrg !== tenant.scope.activeOrg.slug) {
    return NextResponse.json(
      { error: "Active organization changed" },
      { status: 409 }
    );
  }
  if (action === "scopeCapabilities") {
    return forwardToQuarkus(
      orgPath(tenant.scope.activeOrg.slug, ["dashboard-capabilities"]),
      { method: "GET" }
    );
  }
  const segments = ["dashboards"];
  if (context) {
    const { dashboard } = await context.params;
    // URL normalizers resolve dot segments even after percent encoding.
    if (!isSafeIdentifier(dashboard)) {
      return NextResponse.json(
        { error: "Invalid dashboard identifier" },
        { status: 400 }
      );
    }
    segments.push(dashboard);
  }
  if (action === "query") {
    const query = (await context?.params)?.query;
    if (!isSafeIdentifier(query)) {
      return NextResponse.json(
        { error: "Invalid query identifier" },
        { status: 400 }
      );
    }
    segments.push("queries", query);
  } else if (action) segments.push(action);
  let body: unknown;
  if (request.method === "PUT" || request.method === "POST") {
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
    ...(action === "query" ? { signal: request.signal, timeoutMs: 30_000 } : {}),
    body,
    ifMatch: request.headers.get("if-match") ?? undefined,
  });
}
