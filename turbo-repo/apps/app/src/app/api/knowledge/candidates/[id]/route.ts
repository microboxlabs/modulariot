import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../../utils/tenant-scope";
import { reviewCandidate, writeHarnessCard } from "../candidates-client";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * The HUMAN GATE + APPLY step. POST { decision: "approve" | "reject" }:
 * - reject transitions the candidate and stops.
 * - approve transitions it, then WRITES the card to the harness (through the
 *   modulith proxy) so the next run grounds on it — the loop closes.
 *
 * Order matters: approve first (the durable human decision), then apply. If the
 * apply fails, the candidate is still approved and the response reports
 * `cardApplied: false` so the UI can flag "approved, not yet applied". The card
 * write uses the modulith's SERVER-side candidate, never client-sent content.
 */
export async function POST(request: NextRequest, ctx: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const { id } = await ctx.params;
  const body = (await request.json().catch(() => null)) as { decision?: string } | null;
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const orgSlug = scopeResult.scope.activeOrg.slug;
  const token =
    authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? undefined;

  let reviewed;
  try {
    reviewed = await reviewCandidate({ orgSlug, token, id, decision });
  } catch (err) {
    logger.error({ err, id, decision }, "[knowledge/candidates] review failed");
    return NextResponse.json({ error: "review_failed" }, { status: 502 });
  }
  if (!reviewed) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if (decision === "reject") {
    return NextResponse.json({ candidate: reviewed });
  }

  try {
    await writeHarnessCard({
      orgSlug,
      token,
      candidate: reviewed,
      today: new Date().toISOString().slice(0, 10),
    });
    return NextResponse.json({ candidate: reviewed, cardApplied: true });
  } catch (err) {
    logger.error({ err, id }, "[knowledge/candidates] approved but card apply failed");
    return NextResponse.json(
      { candidate: reviewed, cardApplied: false, error: "card_apply_failed" },
      { status: 200 },
    );
  }
}
