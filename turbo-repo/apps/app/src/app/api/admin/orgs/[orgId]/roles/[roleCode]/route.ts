import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";
import { evictAllScopeCaches } from "@/app/api/utils/tenant-scope";

interface RouteParams {
  params: Promise<{ orgId: string; roleCode: string }>;
}

function rolePath(orgId: string, roleCode: string): string {
  return `/api/v1/orgs/${encodeURIComponent(orgId)}/roles/${encodeURIComponent(roleCode)}`;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const resolvedParams = await params;
  const denied = await requireOrganizationOwner(resolvedParams.orgId);
  if (denied) return denied;
  return forwardToQuarkus(
    rolePath(resolvedParams.orgId, resolvedParams.roleCode)
  );
}

export async function PUT(request: Request, { params }: RouteParams) {
  const resolvedParams = await params;
  const denied = await requireOrganizationOwner(resolvedParams.orgId);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const response = await forwardToQuarkus(
    rolePath(resolvedParams.orgId, resolvedParams.roleCode),
    { method: "PUT", body }
  );
  if (response.ok) evictAllScopeCaches();
  return response;
}
