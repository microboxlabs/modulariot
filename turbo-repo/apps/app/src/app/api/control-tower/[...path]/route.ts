import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Proxy to the Control Tower API (`/api/v1/orgs/{org}/control-tower/...`) on the
 * modulith next to the GPS data: `MIOT_STREAMHUB_API_URL`, else `MIOT_MODULITH_URL`.
 */
const proxy = orgApiProxy("control-tower", {
  // Template ownership and telephony logins require the individual user's
  // session; a shared service token cannot identify that operator.
  forward: (path, init) =>
    [
      "/save-as-template",
      "/telephony/webrtc-token",
      "/telephony/reconcile",
    ].some((suffix) => path.split("?")[0].endsWith(suffix)) ||
    /\/telephony\/(calls\/[^/]+\/ended|whatsapp-calls\/[^/]+\/answer)$/.test(
      path.split("?")[0]
    )
      ? forwardToStreamhubModulith(path, { ...init, sessionOnly: true })
      : forwardToStreamhubModulith(path, init),
});

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
