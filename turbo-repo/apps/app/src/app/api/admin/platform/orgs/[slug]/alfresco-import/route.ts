import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { evictAllScopeCaches } from "@/app/api/utils/tenant-scope";
import { platformOrgPath } from "../platform-org-path";

/**
 * POST /api/admin/platform/orgs/[slug]/alfresco-import — copy the
 * organization's Alfresco group into memberships, before switching it to
 * native membership.
 */
interface RouteParams {
  params: Promise<{ slug: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  const { slug } = await params;
  const response = await forwardToQuarkus(
    platformOrgPath(slug, "alfresco-import"),
    { method: "POST", timeoutMs: 120_000 },
  );
  // Imported people gain the organization: cached scopes would hide it.
  if (response.ok) {
    evictAllScopeCaches();
  }
  return response;
}
