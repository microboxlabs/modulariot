import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/model-providers — the AI model providers the
 * harness may call. Keys are never returned, only their last characters.
 *
 * `PlatformModelProvidersResource` requires platform ownership, so this route
 * forwards without a gate of its own.
 */
export async function GET() {
  return forwardToQuarkus("/api/v1/platform/model-providers");
}
