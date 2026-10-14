import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/** The caller's base role, module roles and permissions in the active organization. */
export async function GET() {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return forwardToQuarkus(`/api/v1/orgs/${org}/me/access`);
}
