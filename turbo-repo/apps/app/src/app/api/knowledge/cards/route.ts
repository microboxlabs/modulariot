import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../utils/tenant-scope";
import {
  failureStatus,
  isTrainer,
  listCards,
  listKnowledgeConnections,
  type KnowledgeCard,
} from "../candidates/candidates-client";

interface ConnectionCards {
  connection: string;
  cards: KnowledgeCard[];
  error?: boolean;
}

/**
 * The approved cards of every connection the harness keeps learned facts on,
 * whether they were approved from a candidate or in chat. Both lists come from
 * the harness through the modulith proxy, which requires HARNESS_TRAINER.
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
    if (!(await isTrainer({ orgSlug, token }))) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    connectionNames = (await listKnowledgeConnections({ orgSlug, token })).sort(
      (a, b) => a.localeCompare(b)
    );
  } catch (err) {
    logger.error({ err }, "[knowledge/cards] connections failed");
    const status = failureStatus(err);
    return NextResponse.json(
      { error: status === 403 ? "forbidden" : "list_failed" },
      { status }
    );
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
