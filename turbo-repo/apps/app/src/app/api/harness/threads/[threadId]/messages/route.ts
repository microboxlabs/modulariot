import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** One page of a thread's messages, in the order they were appended.
 * `after` is the last seq the caller holds; `limit` caps the page. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const path = await messagesPath(result.scope.activeOrg.slug, params);
  return forwardToQuarkus(`${path}${pageQuery(new URL(request.url).searchParams)}`);
}

/** Only the two paging parameters travel upstream, re-encoded — the
 * caller's query string is not forwarded as-is. */
function pageQuery(params: URLSearchParams): string {
  const upstream = new URLSearchParams();
  for (const key of ["after", "limit"]) {
    const value = params.get(key);
    if (value && /^\d+$/.test(value)) upstream.set(key, value);
  }
  const query = upstream.toString();
  return query ? `?${query}` : "";
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
