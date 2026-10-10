import { orgApiProxy } from "@/app/api/utils/org-api-proxy";

/** Proxy to the modulith's GPS integration (`/api/v1/orgs/{org}/gps/...`). */
const proxy = orgApiProxy("gps");

export const GET = proxy.GET;
export const POST = proxy.POST;
