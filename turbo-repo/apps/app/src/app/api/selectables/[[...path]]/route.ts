import { orgApiProxy } from "@/app/api/utils/org-api-proxy";

/** Proxy to the modulith core selectables API (`/api/v1/orgs/{org}/selectables[/...]`). */
const proxy = orgApiProxy("selectables", { allowRoot: true });

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
