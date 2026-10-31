import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Proxy to the trips API (`/api/v1/orgs/{org}/trips/...`) on the modulith next
 * to the GPS data: `MIOT_STREAMHUB_API_URL`, else `MIOT_MODULITH_URL`. Always
 * with the user's session, so the modulith checks the user's permission.
 */
const proxy = orgApiProxy("trips", {
  forward: (path, init) =>
    forwardToStreamhubModulith(path, { ...init, sessionOnly: true }),
});

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const DELETE = proxy.DELETE;
export const PATCH = proxy.PATCH;
