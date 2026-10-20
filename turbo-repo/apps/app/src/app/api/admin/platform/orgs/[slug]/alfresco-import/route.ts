import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
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
  return forwardToQuarkus(platformOrgPath(slug, "alfresco-import"), {
    method: "POST",
    timeoutMs: 120_000,
  });
}
