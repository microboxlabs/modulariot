import { platformApiProxy } from "@/app/api/utils/platform-api-proxy";

/**
 * /api/admin/platform/symptom-templates/... — the platform's symptom
 * templates, edited like an organization's symptoms. Proxies to
 * `/api/v1/platform/symptom-templates/...` on the modulith that serves the
 * Control Tower.
 */
const proxy = platformApiProxy("/api/v1/platform/symptom-templates");

export const GET = proxy.GET;
export const DELETE = proxy.DELETE;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
