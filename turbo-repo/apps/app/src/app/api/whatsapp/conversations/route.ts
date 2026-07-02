import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * GET /api/whatsapp/conversations — the Conversations inbox list for the caller's active org.
 * The active org is resolved server-side (no org id in the URL), then proxied to Quarkus
 * GET /api/v1/orgs/{org}/whatsapp/conversations (miot-conversational).
 */
export async function GET() {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(`/api/v1/orgs/${org}/whatsapp/conversations`);
}
