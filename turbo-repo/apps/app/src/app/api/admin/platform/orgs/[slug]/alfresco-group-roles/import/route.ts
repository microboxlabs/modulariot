import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { dryRunQuery, platformOrgPath } from "../../platform-org-path";

/**
 * POST /api/admin/platform/orgs/[slug]/alfresco-group-roles/import[?dryRun=true]
 * — give each member of every mapped group a binding of the mapped role.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  return forwardToQuarkus(
    platformOrgPath(slug, "alfresco-group-roles", "import") +
      dryRunQuery(request),
    { method: "POST", timeoutMs: 120_000 }
  );
}
