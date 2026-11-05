import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { dryRunQuery, platformOrgPath } from "../../platform-org-path";

/**
 * POST /api/admin/platform/orgs/[slug]/alfresco-group-roles/reconcile[?dryRun=true]
 * — queue the changes that make each projected group equal to its roles' holders.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const { slug } = await params;
  return forwardToQuarkus(
    platformOrgPath(slug, "alfresco-group-roles", "reconcile") +
      dryRunQuery(request),
    { method: "POST", timeoutMs: 120_000 }
  );
}
