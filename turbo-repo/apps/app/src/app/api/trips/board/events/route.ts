import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { streamFromStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

export const dynamic = "force-dynamic";

/** The trips board's live changes for the caller's active organization, relayed from the modulith. */
export async function GET(request: Request) {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return streamFromStreamhubModulith(
    `/api/v1/orgs/${org}/trips/board/events`,
    request.signal
  );
}
