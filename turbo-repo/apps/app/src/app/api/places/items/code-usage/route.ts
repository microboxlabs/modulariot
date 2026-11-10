import { NextResponse } from "next/server";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * GET /app/api/places/items/code-usage?code=SCL
 *
 * Whether an External ID is taken in the caller's active organization, so a
 * form can say so before saving.
 */
export async function GET(request: Request) {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;

  const code = new URL(request.url).searchParams.get("code")?.trim();
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return forwardToStreamhubModulith(
    `/api/v1/orgs/${org}/places/items/code-usage?code=${encodeURIComponent(code)}`
  );
}
