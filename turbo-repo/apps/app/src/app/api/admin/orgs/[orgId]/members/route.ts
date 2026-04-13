import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET    /api/admin/orgs/[orgId]/members       — list members
 * POST   /api/admin/orgs/[orgId]/members       — add a member
 *
 * Proxies to Quarkus `GET/POST /api/v1/orgs/{orgId}/members`. The backend's
 * OrganizationRequestFilter + WriteAuthorizer are the authorization boundary:
 * GET requires org membership; POST requires SITE_MANAGER on the parent org.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  return forwardToQuarkus(`/api/v1/orgs/${safe}/members`);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const safe = encodeURIComponent(orgId);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(`/api/v1/orgs/${safe}/members`, {
    method: "POST",
    body,
  });
}
