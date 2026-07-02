import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * POST /api/whatsapp/conversations/{id}/read — clear the unread badge when an agent opens the
 * thread. Proxied to Quarkus POST /api/v1/orgs/{org}/whatsapp/conversations/{id}/read.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const { conversationId } = await params;
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  const id = encodeURIComponent(conversationId);
  return forwardToQuarkus(`/api/v1/orgs/${org}/whatsapp/conversations/${id}/read`, {
    method: "POST",
  });
}
