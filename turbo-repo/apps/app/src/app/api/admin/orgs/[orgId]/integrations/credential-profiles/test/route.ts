import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * POST /api/admin/orgs/[orgId]/integrations/credential-profiles/test
 *
 * Exercises a credential that has not been saved, so a wrong client secret is caught
 * before it is stored. The body carries the secret exactly as the create request would;
 * nothing is persisted. A credential id is never literally "test", and this route is one
 * segment shallower than `[credentialId]/test`, so the two cannot collide.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/credential-profiles/test`,
    { method: "POST", body },
  );
}
