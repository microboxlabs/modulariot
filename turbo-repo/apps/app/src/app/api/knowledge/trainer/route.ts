import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { isTrainer } from "../candidates/candidates-client";

/**
 * Whether the signed-in user may review learned facts and manage cards. Only
 * decides what the UI shows; the modulith enforces the permission on every call.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const token =
    authResult.session.user?.rawJWT ??
    authResult.session.user?.ticket ??
    undefined;

  try {
    const trainer = await isTrainer({
      orgSlug: scopeResult.scope.activeOrg.slug,
      token,
    });
    return NextResponse.json({ trainer });
  } catch (err) {
    logger.error({ err }, "[knowledge/trainer] check failed");
    return NextResponse.json({ error: "check_failed" }, { status: 502 });
  }
}
