import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * GET /api/whatsapp/conversations/{id}/messages — the message timeline for one conversation,
 * proxied to Quarkus GET /api/v1/orgs/{org}/whatsapp/conversations/{id}/messages. Quarkus scopes
 * the conversation to the active org (404 if it belongs to another tenant).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const { conversationId } = await params;
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  const id = encodeURIComponent(conversationId);
  return forwardToQuarkus(`/api/v1/orgs/${org}/whatsapp/conversations/${id}/messages`);
}
