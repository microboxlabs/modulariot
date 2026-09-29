import { type NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { resolveTenantScope } from "../../../utils/tenant-scope";
import {
  editCandidate,
  failureStatus,
  reviewCandidate,
  writeHarnessCard,
} from "../candidates-client";
import { sessionToken } from "@/features/auth/services/session-auth";

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
  const body = (await request.json().catch(() => null)) as {
    decision?: string;
  } | null;
  const decision = body?.decision;
  if (decision !== "approve" && decision !== "reject") {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }

  const orgSlug = scopeResult.scope.activeOrg.slug;
  const token = sessionToken(authResult.session);

  let reviewed;
  try {
    reviewed = await reviewCandidate({ orgSlug, token, id, decision });
  } catch (err) {
    logger.error({ err, id, decision }, "[knowledge/candidates] review failed");
    const status = failureStatus(err);
    return NextResponse.json(
      { error: status === 403 ? "forbidden" : "review_failed" },
      { status }
    );
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
    logger.error(
      { err, id },
      "[knowledge/candidates] approved but card apply failed"
    );
    return NextResponse.json(
      { candidate: reviewed, cardApplied: false, error: "card_apply_failed" },
      { status: 200 }
    );
  }
}

/** Edits a pending candidate's term and body before review. */
export async function PATCH(request: NextRequest, ctx: RouteContext) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;

  const { id } = await ctx.params;
  const payload = (await request.json().catch(() => null)) as {
    term?: unknown;
    body?: unknown;
  } | null;
  const term = typeof payload?.term === "string" ? payload.term.trim() : "";
  const body = typeof payload?.body === "string" ? payload.body.trim() : "";
  if (!term || !body) {
    return NextResponse.json({ error: "invalid_candidate" }, { status: 400 });
  }

  const token = sessionToken(authResult.session);

  try {
    const candidate = await editCandidate({
      orgSlug: scopeResult.scope.activeOrg.slug,
      token,
      id,
      term,
      body,
    });
    if (!candidate) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ candidate });
  } catch (err) {
    logger.error({ err, id }, "[knowledge/candidates] edit failed");
    const status = failureStatus(err);
    return NextResponse.json(
      { error: status === 403 ? "forbidden" : "edit_failed" },
      { status }
    );
  }
}
