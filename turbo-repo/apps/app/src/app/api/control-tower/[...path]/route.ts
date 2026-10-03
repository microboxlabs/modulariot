import { orgApiProxy } from "@/app/api/utils/org-api-proxy";

/** Proxy to the modulith Control Tower API (`/api/v1/orgs/{org}/control-tower/...`). */
const proxy = orgApiProxy("control-tower");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
