import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { platformOrgPath } from "../../../platform-org-path";

/**
 * PUT /api/admin/platform/orgs/[slug]/alfresco-group-roles/[groupId]/[roleKey]
 * — map a group to a role (`{ projected, excludedGroupId }`)
 * DELETE — remove the mapping
 */
interface RouteParams {
  params: Promise<{ slug: string; groupId: string; roleKey: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { slug, groupId, roleKey } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    platformOrgPath(slug, "alfresco-group-roles", groupId, roleKey),
    { method: "PUT", body }
  );
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug, groupId, roleKey } = await params;
  return forwardToQuarkus(
    platformOrgPath(slug, "alfresco-group-roles", groupId, roleKey),
    { method: "DELETE" }
  );
}
