import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/** Asset ids are plates, IMEIs or MACs: letters, digits and `_ - . : @ +` or spaces, never only dots. */
const ASSET_SEGMENT = /^(?!\.+$)[A-Za-z0-9_.:@+ -]{1,128}$/;

/**
 * Proxy to the fleet directory (`/api/v1/orgs/{org}/fleet/...`) on the modulith
 * next to the GPS data: `MIOT_STREAMHUB_API_URL`, else `MIOT_MODULITH_URL`.
 * Always with the user's session, so the modulith checks the user's permission.
 */
const proxy = orgApiProxy("fleet", {
  segment: ASSET_SEGMENT,
  forward: (path, init) =>
    forwardToStreamhubModulith(path, { ...init, sessionOnly: true }),
});

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PATCH = proxy.PATCH;
