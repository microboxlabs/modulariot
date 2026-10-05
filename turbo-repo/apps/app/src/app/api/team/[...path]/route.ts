import { orgApiProxy } from "@/app/api/utils/org-api-proxy";

/** Proxy to the modulith Team API (`/api/v1/orgs/{org}/team/...`): members and invitations. */
const proxy = orgApiProxy("team");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
