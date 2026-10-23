import { orgApiProxy } from "@/app/api/utils/org-api-proxy";
import { forwardToStreamhubModulith } from "@/app/api/utils/streamhub-modulith-proxy";

/**
 * Proxy to the conversations API (`/api/v1/orgs/{org}/conversations/...`):
 * rules, templates, runs and the event catalog. It runs on the modulith that
 * raises the symptom events, the same one as the Control Tower.
 */
const proxy = orgApiProxy("conversations", {
  forward: forwardToStreamhubModulith,
});

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const DELETE = proxy.DELETE;
