import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * POST /api/admin/orgs/[orgId]/integrations/credential-profiles — create a
 * credential profile (e.g. a BEARER_TOKEN holding the WhatsApp access token).
 *
 * Proxies to Quarkus `POST /api/v1/orgs/{orgId}/integrations/credential-profiles`.
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
  return forwardToQuarkus(
    `/api/v1/orgs/${safe}/integrations/credential-profiles`,
    { method: "POST", body },
  );
}
