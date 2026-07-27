import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  getReviewRounds,
  recordReviewRound,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logError } from "@/lib/logger";

const ROUTE = "/app/api/review/rounds";

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
    if ((e as { status?: number })?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to fetch review rounds" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    contentNodeRef?: string;
    verdict?: "APPROVED" | "REJECTED";
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
  // PENDING is not a decision — returning content to review is the absence of a round.
  if (verdict !== "APPROVED" && verdict !== "REJECTED") {
    return NextResponse.json(
      { error: "verdict must be APPROVED or REJECTED" },
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
    if ((e as { status?: number })?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Failed to record review decision" },
      { status: 500 }
    );
  }
}
