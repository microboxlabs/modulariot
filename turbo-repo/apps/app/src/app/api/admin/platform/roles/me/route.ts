import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/roles/me — the platform roles the caller holds.
 *
 * Any authenticated user may read this. The settings UI asks it to decide
 * whether to offer the platform panels at all, so answering 403 to a
 * non-owner would leave the client unable to tell "you hold nothing" from
 * "the request failed". A non-owner gets `{ roleCodes: [] }`.
 */
export async function GET() {
  return forwardToQuarkus("/api/v1/platform/roles/me");
}
