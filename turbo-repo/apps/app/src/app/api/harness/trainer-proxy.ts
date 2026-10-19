import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { requireAuth } from "@/app/api/utils/alfresco-crud-client";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** Where a trainer call goes under the org's harness proxy in the modulith. */
export type TrainerArea = "knowledge" | "learning" | "transcripts";

/** Each segment re-encoded; a dot segment could climb out of the area. */
function encodePath(segments: string[]): string | null {
  if (segments.length === 0) return null;
  if (segments.some((s) => !s || s === "." || s === "..")) return null;
  return segments.map(encodeURIComponent).join("/");
}

/**
 * Forwards a trainer's knowledge, learning or transcript call to the
 * modulith with the caller's session. The modulith checks HARNESS_TRAINER and
 * sets the tenant and author itself.
 */
export async function forwardTrainerCall(
  request: Request,
  area: TrainerArea,
  segments: string[],
  method: "GET" | "PUT" | "POST" | "DELETE"
): Promise<NextResponse> {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const path = encodePath(segments);
  if (!path) {
    return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  }
  const org = encodeURIComponent(scopeResult.scope.activeOrg.slug);
  const query = new URL(request.url).search;
  let body: unknown;
  if (method === "PUT" || method === "POST") {
    body = await request.json().catch(() => undefined);
    if (body === undefined) {
      return NextResponse.json({ error: "invalid_body" }, { status: 400 });
    }
  }
  return forwardToQuarkus(
    `/api/v1/orgs/${org}/harness/${area}/${path}${query}`,
    {
      method,
      ...(body === undefined ? {} : { body }),
    }
  );
}
