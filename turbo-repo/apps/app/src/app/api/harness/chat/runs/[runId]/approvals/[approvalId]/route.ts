import { NextResponse } from "next/server";
import {
  MiotHarnessApiError,
  type ApprovalDecision,
} from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../../../../utils/alfresco-crud-client";
import { logger } from "@/lib/logger";
import { connectToHarness } from "../../../../stream/relay";

const MAX_COMMENT_CHARS = 2000;

function decisionOf(body: unknown): ApprovalDecision | null {
  if (typeof body !== "object" || body === null) return null;
  const { decision, comment } = body as Record<string, unknown>;
  if (decision !== "approve" && decision !== "deny") return null;
  const text =
    decision === "deny" && typeof comment === "string"
      ? comment.trim().slice(0, MAX_COMMENT_CHARS)
      : "";
  return text ? { decision, comment: text } : { decision };
}

/**
 * The approval card's buttons: approves or rejects a call the harness run
 * waits on. The run's own stream carries on with the outcome.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string; approvalId: string }> }
) {
  const { runId, approvalId } = await params;
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const decision = decisionOf(await request.json().catch(() => null));
  if (!decision) {
    return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
  }
  const connection = await connectToHarness(authResult.session);
  if (!connection.ok) {
    return NextResponse.json(
      { error: connection.errorMessage },
      { status: 502 }
    );
  }

  try {
    await connection.client.runs.resolveApproval(runId, approvalId, decision, {
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err: unknown) {
    if (err instanceof MiotHarnessApiError && err.status === 404) {
      return NextResponse.json({ error: "not_pending" }, { status: 404 });
    }
    logger.error(
      { err, runId, approvalId },
      "[harness/chat/runs] approval failed"
    );
    return NextResponse.json({ error: "approval_failed" }, { status: 502 });
  }
  return new Response(null, { status: 204 });
}
