import { NextResponse } from "next/server";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { logger } from "@/lib/logger";
import { modulithHost, isModulithConfigured } from "@/lib/modulith-host";

const EMPTY = { default: null, models: [] as string[] };

/**
 * The conversation models the harness lets a run choose, via
 * `client.models.list()` (`GET /models`). Same auth and org-scope chain as
 * the other harness routes. Empty when the harness has no per-run model.
 */
export async function GET() {
  if (!isModulithConfigured()) {
    return NextResponse.json(EMPTY);
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
    return NextResponse.json(await client.models.list());
  } catch (err: unknown) {
    logger.error({ err }, "[harness/models] failed to fetch models");
    return NextResponse.json(EMPTY);
  }
}
