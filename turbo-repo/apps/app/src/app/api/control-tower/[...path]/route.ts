import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Proxy to the Control Tower API (`/api/v1/orgs/{org}/control-tower/...`) on the
 * modulith next to the GPS data: `MIOT_STREAMHUB_API_URL`, else `MIOT_MODULITH_URL`.
 */
const proxy = orgApiProxy("control-tower", { forward: forwardToStreamhubModulith });

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
