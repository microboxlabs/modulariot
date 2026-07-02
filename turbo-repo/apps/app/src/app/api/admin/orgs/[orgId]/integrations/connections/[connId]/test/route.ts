import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * POST /api/admin/orgs/[orgId]/integrations/connections/[connId]/test
 *
 * Runs the provider's live connectivity probe. Proxies to Quarkus
 * `POST /api/v1/orgs/{orgId}/integrations/connections/{connId}/test`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgId: string; connId: string }> },
) {
  const { orgId, connId } = await params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // No body is fine — the test request is optional.
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${encodeURIComponent(orgId)}/integrations/connections/${encodeURIComponent(connId)}/test`,
    { method: "POST", body },
  );
}
