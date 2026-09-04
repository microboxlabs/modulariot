import { NextResponse } from "next/server";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import { modulithHost, isModulithConfigured } from "@/lib/modulith-host";

/**
 * Lists the skills the harness exposes, via the same `client.skills.list()`
 * call (`GET /skills`) the harness CLI and TUI use — see
 * @microboxlabs/miot-harness-client's skills resource. Same auth/org-scope
 * chain as the other harness routes.
 */

export async function GET() {
  if (!isModulithConfigured()) {
    return NextResponse.json({ skills: [] });
  }

  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  const orgSlug = scopeResult.scope.activeOrg.slug;

  const token = authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? undefined;

  const client = createMiotHarnessClient({
    baseUrl: `${modulithHost()}/api/v1/orgs/${orgSlug}/harness`,
    token,
    headers: authResult.session.user?.email
      ? { "X-Dev-User-Email": authResult.session.user.email }
      : {},
  });

  try {
    const skills = await client.skills.list({ tenant: orgSlug });
    return NextResponse.json({ skills });
  } catch (err: unknown) {
    logger.error({ err }, "[harness/skills] failed to fetch skills");
    return NextResponse.json({ skills: [] });
  }
}
