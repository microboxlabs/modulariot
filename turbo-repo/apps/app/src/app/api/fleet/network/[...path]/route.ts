import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Proxy to the asset network (`/api/v1/orgs/{org}/fleet/network/...`) on the
 * modulith next to the GPS data: `MIOT_STREAMHUB_API_URL`, else `MIOT_MODULITH_URL`.
 */
const proxy = orgApiProxy("fleet/network", {
  forward: forwardToStreamhubModulith,
});

export const GET = proxy.GET;
