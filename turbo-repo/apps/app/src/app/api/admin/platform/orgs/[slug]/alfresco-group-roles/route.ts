import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { platformOrgPath } from "../platform-org-path";

/**
 * GET /api/admin/platform/orgs/[slug]/alfresco-group-roles — the Alfresco
 * groups mapped to module roles. Proxies to Quarkus, which requires platform
 * ownership.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  return forwardToQuarkus(platformOrgPath(slug, "alfresco-group-roles"));
}
