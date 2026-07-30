import { NextResponse } from "next/server";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";
import { listM2MClients } from "@/app/api/utils/auth0-client-directory";
import { logger } from "@/lib/logger";

/**
 * GET /api/admin/orgs/[orgId]/auth0/m2m-clients?q=&limit=
 *
 * Backs the client-id autocomplete on the Auth0 credential form. Answers
 * identifiers and names only — never a secret, and never anything that would let
 * a caller act as one of these clients.
 *
 * Organization-owner gated like the credential routes it serves: which M2M
 * applications an org holds is not something a member needs, and the list is a
 * map of the org's identity surface.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const { orgId } = await params;
  const denied = await requireOrganizationOwner(orgId);
  if (denied) return denied;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim() ?? "";
  const limitRaw = searchParams.get("limit");
  const parsedLimit = Number.parseInt(limitRaw ?? "", 10);

  try {
    const result = await listM2MClients({
      orgId,
      query,
      ...(Number.isFinite(parsedLimit) ? { limit: parsedLimit } : {}),
    });
    return NextResponse.json(result);
  } catch (error) {
    logger.error(
      { err: error, orgId, query },
      "Failed to list Auth0 M2M clients"
    );
    return NextResponse.json(
      { error: "Failed to list Auth0 applications" },
      { status: 502 }
    );
  }
}
