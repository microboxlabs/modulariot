import { NextResponse } from "next/server";
import type { RunSummaryStatus } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { logger } from "@/lib/logger";
import { connectToHarness } from "../stream/relay";

/** The chat's activity panel: the user's running and recent harness runs. */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }
  const connection = await connectToHarness(authResult.session);
  if (!connection.ok) {
    return NextResponse.json(
      { error: connection.errorMessage },
      { status: 502 }
    );
  }

  const params = new URL(request.url).searchParams;
  const limit = Number(params.get("limit"));
  try {
    const runs = await connection.client.runs.list(
      {
        conversation_id: params.get("conversation_id") ?? undefined,
        status: (params.get("status") as RunSummaryStatus | null) ?? undefined,
        limit:
          Number.isInteger(limit) && limit > 0
            ? Math.min(limit, 100)
            : undefined,
      },
      { signal: AbortSignal.timeout(5_000) }
    );
    return NextResponse.json(runs);
  } catch (err: unknown) {
    logger.error({ err }, "[harness/chat/runs] list failed");
    return NextResponse.json({ error: "list_failed" }, { status: 502 });
  }
}
