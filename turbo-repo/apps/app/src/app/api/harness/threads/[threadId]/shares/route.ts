import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** Give one other person read access to a thread the caller owns. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const body = await request.json().catch(() => null);
  const { threadId } = await params;
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(
    `/api/v1/orgs/${org}/chat/threads/${encodeURIComponent(threadId)}/shares`,
    { method: "POST", body },
  );
}
