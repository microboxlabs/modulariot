import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/branding/domains — every configured domain.
 *
 * Metadata only; the modulith never returns the logo bytes here. The settings
 * UI renders each preview from the public `/branding/{domain}/logo`, which the
 * browser can cache, rather than inlining images into this response.
 *
 * `PlatformBrandingResource` requires platform ownership on every method, so
 * this route forwards without a gate of its own.
 */
export async function GET() {
  return forwardToQuarkus("/api/v1/platform/branding/domains");
}
