import { platformApiProxy } from "@/app/api/utils/platform-api-proxy";

/**
 * /api/admin/platform/whatsapp-templates/... — the WhatsApp templates on
 * Meta of the platform's WhatsApp connection. Proxies to
 * `/api/v1/platform/whatsapp-templates/...` on the modulith that serves the
 * conversations (GET, POST, PUT and DELETE).
 */
const proxy = platformApiProxy("/api/v1/platform/whatsapp-templates");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const DELETE = proxy.DELETE;
