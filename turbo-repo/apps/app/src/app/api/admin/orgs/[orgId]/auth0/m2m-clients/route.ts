import { NextResponse } from "next/server";
import { requireOrganizationOwner } from "@/app/api/utils/organization-owner";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
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
 * map of the org's identity surface. Quarkus enforces the same role again.
 *
 * Normally proxies to miot-integrations, which computes entitlement from the
 * organization tree. `MIOT_AUTH0_ADMIN_MODE=stub` keeps the local fixture path
 * for working on the form without a modulith running.
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

  if (process.env.MIOT_AUTH0_ADMIN_MODE === "stub") {
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
        "Failed to list Auth0 M2M clients from the local stub"
      );
      return NextResponse.json(
        { error: "Failed to list Auth0 applications" },
        { status: 502 }
      );
    }
  }

  const safe = encodeURIComponent(orgId);
  const upstream = new URLSearchParams();
  if (query) upstream.set("q", query);
  if (Number.isFinite(parsedLimit)) upstream.set("limit", String(parsedLimit));
  const suffix = upstream.toString() ? `?${upstream}` : "";
  return forwardToQuarkus(
    `/api/v1/orgs/${safe}/integrations/auth0/clients${suffix}`
  );
}
