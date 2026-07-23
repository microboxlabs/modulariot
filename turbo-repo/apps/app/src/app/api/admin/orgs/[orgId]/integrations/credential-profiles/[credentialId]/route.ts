import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET/PATCH/DELETE /api/admin/orgs/[orgId]/integrations/credential-profiles/[credentialId]
 *
 * Proxies to Quarkus `/api/v1/orgs/{orgId}/integrations/credential-profiles/{id}`.
 * DELETE answers 409 with the referencing consumers while the credential is still in
 * use; `?force=true` deletes anyway. That status is forwarded verbatim so the UI can
 * name what would break.
 */
function upstream(orgId: string, credentialId: string): string {
  return `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/credential-profiles/${encodeURIComponent(credentialId)}`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; credentialId: string }> },
) {
  const { orgId, credentialId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToQuarkus(upstream(orgId, credentialId));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; credentialId: string }> },
) {
  const { orgId, credentialId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(upstream(orgId, credentialId), {
    method: "PATCH",
    body,
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ orgId: string; credentialId: string }> },
) {
  const { orgId, credentialId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const force = new URL(request.url).searchParams.get("force") === "true";
  return forwardToQuarkus(
    `${upstream(orgId, credentialId)}${force ? "?force=true" : ""}`,
    { method: "DELETE" },
  );
}
