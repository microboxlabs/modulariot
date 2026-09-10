import { NextResponse } from "next/server";
import { createMiotHarnessClient } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../utils/alfresco-crud-client";
import { resolveTenantScope } from "../utils/tenant-scope";
import { modulithHost } from "@/lib/modulith-host";

type HarnessRouteClient =
  | { ok: true; client: ReturnType<typeof createMiotHarnessClient>; orgSlug: string }
  | { ok: false; response: NextResponse };

/**
 * The auth and org-scope chain shared by the harness routes, ending in a
 * client bound to the active org's harness proxy. `ok: false` carries the
 * response to return as-is.
 */
export async function harnessRouteClient(): Promise<HarnessRouteClient> {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return { ok: false, response: authResult.response };

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return { ok: false, response: scopeResult.response };
  const orgSlug = scopeResult.scope.activeOrg.slug;

  const user = authResult.session.user;
  const client = createMiotHarnessClient({
    baseUrl: `${modulithHost()}/api/v1/orgs/${orgSlug}/harness`,
    token: user?.rawJWT ?? user?.ticket ?? undefined,
    headers: user?.email ? { "X-Dev-User-Email": user.email } : {},
  });
  return { ok: true, client, orgSlug };
}
