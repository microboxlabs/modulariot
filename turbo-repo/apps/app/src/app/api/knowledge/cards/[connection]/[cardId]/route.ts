import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../../../utils/tenant-scope";
import {
  deleteCard,
  failureStatus,
} from "../../../candidates/candidates-client";

type RouteContext = { params: Promise<{ connection: string; cardId: string }> };

/** Removes one approved card from a connection. */
export async function DELETE(_request: Request, ctx: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const { connection, cardId } = await ctx.params;
  const token =
    authResult.session.user?.rawJWT ??
    authResult.session.user?.ticket ??
    undefined;

  try {
    const deleted = await deleteCard({
      orgSlug: scopeResult.scope.activeOrg.slug,
      token,
      connection,
      cardId,
    });
    if (!deleted) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    logger.error(
      { err, connection, cardId },
      "[knowledge/cards] delete failed"
    );
    const status = failureStatus(err);
    return NextResponse.json(
      { error: status === 403 ? "forbidden" : "delete_failed" },
      { status }
    );
  }
}
