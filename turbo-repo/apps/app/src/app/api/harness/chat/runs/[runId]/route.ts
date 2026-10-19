import { NextResponse } from "next/server";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import {
  getDictionary,
  getLocaleFromHeaders,
} from "@/features/i18n/i18n.service";
import { logger } from "@/lib/logger";
import { connectToHarness } from "../../stream/relay";
import { mapRunActivity } from "./activity";

/** What the agent did in one harness run, for the chat's activity timeline. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId } = await params;
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

  try {
    const record = await connection.client.runs.get(runId, {
      signal: AbortSignal.timeout(10_000),
    });
    const [tr] = await getDictionary(getLocaleFromHeaders(request.headers));
    return NextResponse.json(mapRunActivity(record, tr), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (err: unknown) {
    // Another tenant's run is refused upstream; either way there is nothing to show.
    if (
      err instanceof MiotHarnessApiError &&
      (err.status === 404 || err.status === 403)
    ) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    logger.error({ err, runId }, "[harness/chat/runs] activity failed");
    return NextResponse.json({ error: "activity_failed" }, { status: 502 });
  }
}
