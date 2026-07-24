import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

interface PermissionRouteParams {
  readonly orgId: string;
  readonly permissionCode: string;
}

function permissionPath({
  orgId,
  permissionCode,
}: PermissionRouteParams): string {
  return `/api/v1/orgs/${encodeURIComponent(orgId)}/permissions/${encodeURIComponent(permissionCode)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<PermissionRouteParams> }
) {
  const resolvedParams = await params;
  const denied = await requireOrganizationOwner(resolvedParams.orgId);
  if (denied) return denied;
  return forwardToQuarkus(permissionPath(resolvedParams));
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<PermissionRouteParams> }
) {
  const resolvedParams = await params;
  const denied = await requireOrganizationOwner(resolvedParams.orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(permissionPath(resolvedParams), {
    method: "PUT",
    body,
  });
}
