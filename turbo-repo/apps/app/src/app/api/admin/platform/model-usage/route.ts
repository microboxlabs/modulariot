import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";

/**
 * GET /api/admin/platform/model-usage?from=&to=&organization= — tokens and
 * cost per organization and model. Proxies to Quarkus
 * `/api/v1/platform/model-usage`, which requires platform ownership and
 * validates the period.
 */
export async function GET(request: Request) {
  const incoming = new URL(request.url).searchParams;
  const query = new URLSearchParams();
  for (const key of ["from", "to", "organization"]) {
    const value = incoming.get(key);
    if (value) query.set(key, value);
  }
  return forwardToQuarkus(`/api/v1/platform/model-usage?${query.toString()}`);
}
