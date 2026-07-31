import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getReviewRounds,
  recordReviewRound,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logError } from "@/lib/logger";

const ROUTE = "/app/api/review/rounds";

/**
 * Turns an upstream failure into a response, keeping the repository's own message when it
 * rejected the request.
 *
 * A blanket 500 here cost a debugging session: the repository answered a `PENDING` verdict
 * with "verdict must be APPROVED or REJECTED, got: PENDING" — exactly the sentence needed —
 * and this route replaced it with "Failed to record review decision". A 4xx is the caller
 * being told what it got wrong, so it is passed through; anything else is ours to own and
 * stays generic.
 */
function upstreamError(e: unknown, fallback: string): NextResponse {
  const status = (e as { status?: number })?.status;
  if (status === 401) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    const message = (e as { message?: string })?.message;
    return NextResponse.json({ error: message || fallback }, { status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contentNodeRef = new URL(req.url).searchParams.get("contentNodeRef");
  if (!contentNodeRef) {
    return NextResponse.json(
      { error: "contentNodeRef is required" },
      { status: 400 }
    );
  }

  try {
    return NextResponse.json(await getReviewRounds(session, contentNodeRef));
  } catch (e: unknown) {
    logError(e as Error, { route: `GET ${ROUTE}`, contentNodeRef });
    return upstreamError(e, "Failed to fetch review rounds");
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    contentNodeRef?: string;
    verdict?: "APPROVED" | "REJECTED" | "PENDING";
    reasons?: string[];
    comment?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { contentNodeRef, verdict } = body;
  if (!contentNodeRef) {
    return NextResponse.json(
      { error: "contentNodeRef is required" },
      { status: 400 }
    );
  }
  if (verdict !== "APPROVED" && verdict !== "REJECTED" && verdict !== "PENDING") {
    return NextResponse.json(
      { error: "verdict must be APPROVED, REJECTED or PENDING" },
      { status: 400 }
    );
  }

  try {
    const round = await recordReviewRound(session, {
      contentNodeRef,
      verdict,
      reasons: body.reasons,
      comment: body.comment,
    });
    return NextResponse.json(round, { status: 201 });
  } catch (e: unknown) {
    logError(e as Error, { route: `POST ${ROUTE}`, contentNodeRef, verdict });
    return upstreamError(e, "Failed to record review decision");
  }
}
