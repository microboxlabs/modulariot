import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/roles/[roleCode] — who holds the role
 * PUT /api/admin/platform/roles/[roleCode] — replace its database assignees
 *
 * Proxies to Quarkus `/api/v1/platform/roles/{roleCode}`. There is no
 * Next-side gate as there is for the organization routes: a platform role
 * belongs to no organization, so `requireOrganizationOwner` has nothing to
 * scope against, and `PlatformRoleService` already requires platform
 * ownership before it reads the role code or the request body.
 */
interface RouteParams {
  params: Promise<{ roleCode: string }>;
}

function rolePath(roleCode: string): string {
  return `/api/v1/platform/roles/${encodeURIComponent(roleCode)}`;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { roleCode } = await params;
  return forwardToQuarkus(rolePath(roleCode));
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { roleCode } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(rolePath(roleCode), { method: "PUT", body });
}
