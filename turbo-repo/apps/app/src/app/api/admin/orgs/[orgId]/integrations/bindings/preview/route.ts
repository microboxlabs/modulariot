import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";

/**
 * POST /api/admin/orgs/[orgId]/integrations/bindings/preview — render a candidate
 * mapping without storing it.
 *
 * The drawer previews templates in the browser with Handlebars; this renders the
 * same mapping with the engine that will actually send it, so an operator can
 * confirm the two agree before saving.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> },
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;
  const safe = encodeURIComponent(orgId);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${safe}/integrations/bindings/preview`,
    { method: "POST", body },
  );
}
