import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { platformOrgPath } from "../platform-org-path";

/**
 * GET /api/admin/platform/orgs/[slug]/token-roles — the role ids in sign-in
 * tokens mapped to the organization's roles.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  return forwardToQuarkus(platformOrgPath(slug, "token-roles"));
}
