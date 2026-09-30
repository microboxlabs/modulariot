import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * Forwards to the modulith's `/api/v1/orgs/{org}/selectables{suffix}` for the
 * caller's active organization, resolved here rather than sent by the browser.
 */
export async function forwardSelectables(
  suffix: string,
  init?: Parameters<typeof forwardToQuarkus>[1]
) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(`/api/v1/orgs/${org}/selectables${suffix}`, init);
}

export async function keySegment(params: Promise<{ key: string }>) {
  const { key } = await params;
  return `/${encodeURIComponent(key)}`;
}
