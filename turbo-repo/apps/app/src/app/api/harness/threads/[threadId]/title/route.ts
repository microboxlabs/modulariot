import { NextResponse } from "next/server";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { logger } from "@/lib/logger";
import { harnessRouteClient } from "../../../harness-route-client";

/**
 * Titles a thread from its first exchange: the harness writes the title, the
 * thread store saves it unless the person already named the thread.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const body = (await request.json().catch(() => null)) as {
    message?: unknown;
    answer?: unknown;
  } | null;
  if (typeof body?.message !== "string" || !body.message.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  const answer = typeof body.answer === "string" ? body.answer : "";

  const route = await harnessRouteClient();
  if (!route.ok) return route.response;

  let title: string;
  try {
    title = (
      await route.client.titles.create({ message: body.message, answer })
    ).title;
  } catch (err: unknown) {
    logger.warn(
      { err },
      "[harness/threads/title] harness could not title the thread"
    );
    return NextResponse.json({ error: "title unavailable" }, { status: 503 });
  }

  const { threadId } = await params;
  const org = encodeURIComponent(route.orgSlug);
  return forwardToQuarkus(
    `/api/v1/orgs/${org}/chat/threads/${encodeURIComponent(threadId)}`,
    { method: "PATCH", body: { title, autoTitle: true } }
  );
}
