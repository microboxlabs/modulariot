import { orgApiProxy } from "@/app/api/utils/org-api-proxy";

/** Proxy to the modulith's organization email templates (`/api/v1/orgs/{org}/mail-templates/...`). */
const proxy = orgApiProxy("mail-templates");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const DELETE = proxy.DELETE;
