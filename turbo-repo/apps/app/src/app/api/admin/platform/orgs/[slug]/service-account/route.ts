import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { platformOrgPath } from "../platform-org-path";

/**
 * GET  /api/admin/platform/orgs/[slug]/service-account — the organization's Google service account.
 * POST /api/admin/platform/orgs/[slug]/service-account — create it.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  return forwardToQuarkus(platformOrgPath(slug, "service-account"));
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  return forwardToQuarkus(platformOrgPath(slug, "service-account"), {
    method: "POST",
  });
}
