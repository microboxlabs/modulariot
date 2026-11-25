import "server-only";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { orgPath } from "@/app/api/utils/org-proxy";

export type DashboardRouteContext = {
  params: Promise<{ dashboard: string; query?: string }>;
};

export type DashboardFolderRouteContext = {
  params: Promise<{ folder: string }>;
};

function isSafeIdentifier(value: string | undefined): value is string {
  return (
    !!value && !value.split("/").some((part) => part === "." || part === "..")
  );
}

const SCOPE_PATHS = {
  scopeCapabilities: "dashboard-capabilities",
} as const;

/** Active-org selection and session authentication stay on the server. */
export async function forwardDashboard(
  request: Request,
  context?: DashboardRouteContext,
  action?:
    | "capabilities"
    | "permissions"
    | "query"
    | "scopeCapabilities"
    | "query-catalog"
    | "folder"
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
  // Scope-wide reads with paths of their own, apart from /dashboards so a
  // dashboard named "capabilities" keeps its address.
  if (action === "scopeCapabilities") {
    return forwardToQuarkus(
      orgPath(tenant.scope.activeOrg.slug, [SCOPE_PATHS[action]]),
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
  const body = await readJsonBody(request);
  if (body instanceof NextResponse) return body;
  return forwardToQuarkus(orgPath(tenant.scope.activeOrg.slug, segments), {
    method: request.method,
    ...(action === "query"
      ? { signal: request.signal, timeoutMs: 30_000 }
      : {}),
    body,
    ifMatch: request.headers.get("if-match") ?? undefined,
  });
}

/** The parsed body of a write, undefined for a read, or a 400 response. */
async function readJsonBody(request: Request): Promise<unknown> {
  if (!["PUT", "POST", "PATCH"].includes(request.method)) return undefined;
  try {
    // Starring is a PUT with nothing to say. Next hands such a request an
    // empty body stream rather than none, so read the text to tell.
    const text = await request.text();
    if (text.trim() === "") return undefined;
    return JSON.parse(text) as unknown;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON" },
      { status: 400 }
    );
  }
}

/**
 * The dashboard folders of the active organization: the collection without
 * a context, one folder with it. Same session and org checks as above.
 */
export async function forwardDashboardFolders(
  request: Request,
  context?: DashboardFolderRouteContext,
  action?: "permissions"
) {
  const tenant = await resolveTenantScope();
  if (!tenant.resolved) return tenant.response;
  const expectedOrg = new URL(request.url).searchParams.get("org");
  if (expectedOrg !== null && expectedOrg !== tenant.scope.activeOrg.slug) {
    return NextResponse.json(
      { error: "Active organization changed" },
      { status: 409 }
    );
  }
  const segments = ["dashboard-folders"];
  if (context) {
    const { folder } = await context.params;
    if (!isSafeIdentifier(folder)) {
      return NextResponse.json(
        { error: "Invalid folder identifier" },
        { status: 400 }
      );
    }
    segments.push(folder);
    if (action) segments.push(action);
  }
  const body = await readJsonBody(request);
  if (body instanceof NextResponse) return body;
  return forwardToQuarkus(orgPath(tenant.scope.activeOrg.slug, segments), {
    method: request.method,
    body,
  });
}
