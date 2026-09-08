import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** Replay one thread's messages, in the order they were appended. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  return forwardToQuarkus(await messagesPath(result.scope.activeOrg.slug, params));
}

/** Append one message. Upserts on the message id upstream, so the runtime may
 * rewrite a message it already sent. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const body = await request.json().catch(() => null);
  return forwardToQuarkus(await messagesPath(result.scope.activeOrg.slug, params), {
    method: "POST",
    body,
  });
}

async function messagesPath(slug: string, params: Promise<{ threadId: string }>) {
  const { threadId } = await params;
  const org = encodeURIComponent(slug);
  return `/api/v1/orgs/${org}/chat/threads/${encodeURIComponent(threadId)}/messages`;
}
