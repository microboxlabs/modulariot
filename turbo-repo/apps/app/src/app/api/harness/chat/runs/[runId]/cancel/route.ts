import { NextResponse } from "next/server";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";
import { requireAuth } from "../../../../../utils/alfresco-crud-client";
import { logger } from "@/lib/logger";
import { connectToHarness } from "../../../stream/relay";

/**
 * The chat panel's Stop button. Closing or reloading the page only stops the
 * relay; this is the one way the panel ends a harness run.
 */
export async function POST(
  _request: Request,
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
    await connection.client.runs.cancel(runId, {
      signal: AbortSignal.timeout(5_000),
    });
  } catch (err: unknown) {
    // Not in flight: it already finished, which is what Stop wanted.
    if (!(err instanceof MiotHarnessApiError && err.status === 404)) {
      logger.error({ err, runId }, "[harness/chat/runs] cancel failed");
      return NextResponse.json({ error: "cancel_failed" }, { status: 502 });
    }
  }
  return new Response(null, { status: 204 });
}
