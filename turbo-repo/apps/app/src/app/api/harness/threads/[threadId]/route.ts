import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** One thread's metadata, including the summary the harness compacted it into. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  return forwardToQuarkus(await threadPath(result.scope.activeOrg.slug, params));
}

/** Rename a thread, change when it expires, or store the harness's summary of it. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const body = await request.json().catch(() => null);
  return forwardToQuarkus(await threadPath(result.scope.activeOrg.slug, params), {
    method: "PATCH",
    body,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  return forwardToQuarkus(await threadPath(result.scope.activeOrg.slug, params), {
    method: "DELETE",
  });
}

async function threadPath(slug: string, params: Promise<{ threadId: string }>) {
  const { threadId } = await params;
  return `/api/v1/orgs/${encodeURIComponent(slug)}/chat/threads/${encodeURIComponent(threadId)}`;
}
