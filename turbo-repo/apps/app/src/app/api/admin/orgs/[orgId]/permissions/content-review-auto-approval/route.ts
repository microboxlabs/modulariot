import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationSettingsAdmin } from "@/app/api/utils/organization-settings-admin";

const suffix = "/permissions/content-review-auto-approval";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const denied = await requireOrganizationSettingsAdmin(orgId);
  if (denied) return denied;
  return forwardToQuarkus(`/api/v1/orgs/${encodeURIComponent(orgId)}${suffix}`);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const denied = await requireOrganizationSettingsAdmin(orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}${suffix}`,
    { method: "PUT", body }
  );
}
