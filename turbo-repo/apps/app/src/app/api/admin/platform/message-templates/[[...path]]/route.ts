import { platformApiProxy } from "@/app/api/utils/platform-api-proxy";

/**
 * /api/admin/platform/message-templates/... — the platform's message
 * templates, which every organization's rules send. Proxies to
 * `/api/v1/platform/message-templates/...` on the modulith that serves the
 * conversations, which reads and saves them (GET and PUT only).
 */
const proxy = platformApiProxy("/api/v1/platform/message-templates");

export const GET = proxy.GET;
export const PUT = proxy.PUT;
