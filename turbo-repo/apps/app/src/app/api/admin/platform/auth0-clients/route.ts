import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/auth0-clients — the Auth0 M2M applications and the
 * organization using each. Proxies to Quarkus `/api/v1/platform/auth0-clients`,
 * which requires platform ownership; 409 when Auth0 management is not set up.
 */
export async function GET() {
  return forwardToQuarkus("/api/v1/platform/auth0-clients");
}
