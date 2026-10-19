import { requireAuth } from "../../../../../utils/alfresco-crud-client";
import {
  getDictionary,
  getLocaleFromHeaders,
} from "@/features/i18n/i18n.service";
import { isModulithConfigured } from "@/lib/modulith-host";
import {
  connectToHarness,
  relayRun,
  relaySignal,
  reportRelayFailure,
  sseResponse,
} from "../../../stream/relay";

/**
 * Re-attaches the chat panel to a harness run it lost on reload: the same
 * AG-UI stream the chat route sends, rebuilt from the run's first event, so
 * the panel redraws the answer in progress and follows it to the end.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const { runId: harnessRunId } = await params;
  const url = new URL(request.url);
  const threadId = url.searchParams.get("threadId") ?? crypto.randomUUID();
  const runId = url.searchParams.get("runId") ?? crypto.randomUUID();
  const [tr] = await getDictionary(getLocaleFromHeaders(request.headers));

  return sseResponse(async (send) => {
    send({ type: "RUN_STARTED", runId, threadId });

    const authResult = await requireAuth();
    if (!authResult.authenticated) {
      send({ type: "RUN_ERROR", message: "unauthenticated" });
      return;
    }
    if (!isModulithConfigured()) {
      send({ type: "RUN_ERROR", message: "unconfigured" });
      return;
    }
    const connection = await connectToHarness(authResult.session);
    if (!connection.ok) {
      send({ type: "RUN_ERROR", message: connection.errorMessage });
      return;
    }

    const { client } = connection;
    const relay = relaySignal(request.signal);
    try {
      await relayRun({
        client,
        harnessRunId,
        runId,
        threadId,
        signal: relay.signal,
        send,
        tr,
      });
    } catch (err: unknown) {
      reportRelayFailure(err, {
        send,
        tr,
        runId,
        threadId,
        client,
        harnessRunId,
        timedOut: relay.timedOut(),
        aborted: relay.signal.aborted,
      });
    } finally {
      relay.dispose();
    }
  });
}
