import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { evictAllScopeCaches } from "@/app/api/utils/tenant-scope";

/**
 * Proxy to the modulith Team API (`/api/v1/orgs/{org}/team/...`): members, invitations, teams, bindings, service accounts and keys.
 * A successful change clears the cached scopes, which hold each user's role in the organization.
 */
const proxy = orgApiProxy("team", {
  forward: async (path, init) => {
    const response = await forwardToQuarkus(path, init);
    if (response.ok && init.method !== "GET") evictAllScopeCaches();
    return response;
  },
});

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
