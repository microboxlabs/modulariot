import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import {
  failureStatus,
  listCandidates,
  listCards,
  type KnowledgeCard,
} from "../candidates/candidates-client";

interface ConnectionCards {
  connection: string;
  cards: KnowledgeCard[];
  error?: boolean;
}

/**
 * The approved cards of every connection that has an approved candidate. The
 * connections come from the candidate history; the cards come from the harness
 * through the modulith proxy, which requires HARNESS_TRAINER.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const orgSlug = scopeResult.scope.activeOrg.slug;
  const token =
    authResult.session.user?.rawJWT ??
    authResult.session.user?.ticket ??
    undefined;

  let connectionNames: string[];
  try {
    const approved = await listCandidates({
      orgSlug,
      token,
      status: "approved",
      limit: 500,
    });
    connectionNames = [...new Set(approved.map((c) => c.connection))].sort();
  } catch (err) {
    logger.error({ err }, "[knowledge/cards] candidate history failed");
    return NextResponse.json({ error: "list_failed" }, { status: 502 });
  }

  const results = await Promise.allSettled(
    connectionNames.map((connection) =>
      listCards({ orgSlug, token, connection })
    )
  );
  const forbidden = results.some(
    (r) => r.status === "rejected" && failureStatus(r.reason) === 403
  );
  if (forbidden) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const connections: ConnectionCards[] = results.map((r, i) => {
    if (r.status === "fulfilled") {
      return { connection: connectionNames[i], cards: r.value };
    }
    logger.warn(
      { err: r.reason, connection: connectionNames[i] },
      "[knowledge/cards] list failed"
    );
    return { connection: connectionNames[i], cards: [], error: true };
  });
  return NextResponse.json({ connections });
}
