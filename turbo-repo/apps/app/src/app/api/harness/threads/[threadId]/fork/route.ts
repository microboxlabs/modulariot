import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** Copy a thread the caller can read into a new thread they own. An empty
 * body copies every message; a body that does not parse is refused rather
 * than read as one. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const raw = await request.text();
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
    }
  }
  const { threadId } = await params;
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(
    `/api/v1/orgs/${org}/chat/threads/${encodeURIComponent(threadId)}/fork`,
    { method: "POST", body }
  );
}
