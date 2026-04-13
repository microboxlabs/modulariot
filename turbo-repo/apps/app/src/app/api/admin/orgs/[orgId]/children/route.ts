import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * POST /api/admin/orgs/[orgId]/children
 *
 * Creates a sub-account under the given parent organization by proxying
 * to Quarkus `POST /api/v1/orgs/{parentSlug}/children`. The server
 * validates the tax id, ensures slug/tax_id uniqueness, creates the
 * corresponding Alfresco group, and persists the new org row. Requires
 * SITE_MANAGER on the parent.
 */
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
  return forwardToQuarkus(`/api/v1/orgs/${safe}/children`, {
    method: "POST",
    body,
  });
}
