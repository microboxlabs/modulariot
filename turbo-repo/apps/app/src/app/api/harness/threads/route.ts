import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";

/**
 * The chat panel's threads, proxied to the modulith under the active org. The
 * browser holds no modulith token, so these thin routes forward the session's.
 * Ownership and sharing are decided upstream from the session identity, never
 * from anything the browser sends.
 */
export async function GET(request: Request) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const params = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const name of ["limit", "kind"]) {
    const value = params.get(name);
    if (value) query.set(name, value);
  }
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  const search = query.size > 0 ? `?${query}` : "";
  return forwardToQuarkus(`/api/v1/orgs/${org}/chat/threads${search}`);
}

export async function POST(request: Request) {
  const result = await resolveTenantScope();
  if (!result.resolved) return result.response;

  const body = await request.json().catch(() => null);
  const org = encodeURIComponent(result.scope.activeOrg.slug);
  return forwardToQuarkus(`/api/v1/orgs/${org}/chat/threads`, { method: "POST", body });
}
