import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** Revoke one person's access to a thread. */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string; principal: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const { threadId, principal } = await params;
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(
    `/api/v1/orgs/${org}/chat/threads/${encodeURIComponent(threadId)}/shares/${encodeURIComponent(principal)}`,
    { method: "DELETE" },
  );
}
