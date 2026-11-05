import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { platformOrgPath } from "../../platform-org-path";

/**
 * PUT /api/admin/platform/orgs/[slug]/token-roles/[externalId] — map a token
 * role id to a role (`{ roleKey }`)
 * DELETE — remove the mapping
 */
interface RouteParams {
  params: Promise<{ slug: string; externalId: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const { slug, externalId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(platformOrgPath(slug, "token-roles", externalId), {
    method: "PUT",
    body,
  });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { slug, externalId } = await params;
  return forwardToQuarkus(platformOrgPath(slug, "token-roles", externalId), {
    method: "DELETE",
  });
}
