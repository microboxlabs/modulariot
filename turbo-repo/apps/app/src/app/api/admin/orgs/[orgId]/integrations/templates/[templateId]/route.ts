import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * GET/PATCH/DELETE /api/admin/orgs/[orgId]/integrations/templates/[templateId]
 *
 * Proxies to Quarkus `.../integrations/templates/{templateId}`. DELETE answers 409
 * (forwarded verbatim) while connections are still instances of the template.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> }
) {
  const { orgId, templateId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToQuarkus(templatePath(orgId, templateId));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> }
) {
  const { orgId, templateId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(templatePath(orgId, templateId), {
    method: "PATCH",
    body,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgId: string; templateId: string }> }
) {
  const { orgId, templateId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  return forwardToQuarkus(templatePath(orgId, templateId), { method: "DELETE" });
}

function templatePath(orgId: string, templateId: string): string {
  return `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/templates/${encodeURIComponent(templateId)}`;
}
