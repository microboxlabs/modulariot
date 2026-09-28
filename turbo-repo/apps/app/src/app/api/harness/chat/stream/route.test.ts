/**
 * The chat relay, its re-attach route and Stop: a caller that goes away
 * (reload, closed tab) leaves the harness run alone; only Stop cancels it,
 * and a reload can follow the run again from its first event.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";

const requireAuthMock = vi.fn();
const runsCreateMock = vi.fn();
const runsGetMock = vi.fn();
const runsStreamMock = vi.fn();
const runsCancelMock = vi.fn();

vi.mock("../../../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("../../../utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  }),
}));

vi.mock("@/lib/modulith-host", () => ({
  modulithHost: () => "http://modulith.test",
  isModulithConfigured: () => true,
}));

vi.mock("@microboxlabs/miot-harness-client", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@microboxlabs/miot-harness-client")
  >()),
  createMiotHarnessClient: () => ({
    runs: {
      create: (...args: unknown[]) => runsCreateMock(...args),
      get: (...args: unknown[]) => runsGetMock(...args),
      stream: (...args: unknown[]) => runsStreamMock(...args),
      cancel: (...args: unknown[]) => runsCancelMock(...args),
    },
    models: { list: async () => ({ default: null, models: [] }) },
  }),
}));

vi.mock("@/features/i18n/i18n.service", () => ({
  getDictionary: async () => [(key: string) => key],
  getLocaleFromHeaders: () => "en",
}));

vi.mock("../../../interactions/episodes/record-episode", () => ({
  recordEpisode: vi.fn(async () => {}),
}));

vi.mock("./thread-model", () => ({
  fetchThread: vi.fn(),
  storedThreadModel: async () => null,
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { POST } from "./route";
import { GET as RESUME } from "../runs/[runId]/stream/route";
import { POST as CANCEL } from "../runs/[runId]/cancel/route";
import { SSE_KEEPALIVE_MS, sseResponse } from "./relay";

type AgUiEvent = { type: string; [key: string]: unknown };

function harnessEvent(
  type: string,
  seq: number,
  data: Record<string, unknown> = {}
) {
  return {
    id: `evt_${seq}`,
    run_id: "run_1",
    seq,
    type,
    message: "",
    data,
    created_at: "2026-09-28T00:00:00Z",
  };
}

const completedRecord = {
  run_id: "run_1",
  answer: JSON.stringify([{ type: "markdown", value: "41 trips" }]),
  events: [],
  conversation_id: "thread-1",
  conversation_summary: null,
  context: { model: "m" },
};

/** jsdom's AbortSignal is not one undici's Request follows, so the caller's
 * signal is put on the request directly. */
function withSignal(request: Request, signal?: AbortSignal): Request {
  if (signal) Object.defineProperty(request, "signal", { value: signal });
  return request;
}

function chatRequest(signal?: AbortSignal): Request {
  const request = new Request("http://test/api/harness/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runId: "agui-1",
      threadId: "thread-1",
      messages: [{ id: "u1", role: "user", content: "how many trips?" }],
    }),
  });
  return withSignal(request, signal);
}

/** Reads AG-UI frames off the response until `until` matches one, or the
 * stream ends. */
async function readEvents(
  res: Response,
  until?: (event: AgUiEvent) => boolean
): Promise<{
  events: AgUiEvent[];
  reader: ReadableStreamDefaultReader<Uint8Array>;
}> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  const events: AgUiEvent[] = [];
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      if (!frame.startsWith("data: ")) continue;
      const event = JSON.parse(frame.slice(6)) as AgUiEvent;
      events.push(event);
      if (until?.(event)) return { events, reader };
    }
  }
  return { events, reader };
}

/** A harness run that emits one event, then waits until the relay lets go. */
function blockingRun() {
  runsStreamMock.mockImplementation(async function* (
    _id: string,
    opts: { signal: AbortSignal }
  ) {
    yield harnessEvent("agent.started", 1);
    await new Promise((_, reject) => {
      const abort = () => reject(new DOMException("aborted", "AbortError"));
      if (opts.signal.aborted) abort();
      opts.signal.addEventListener("abort", abort);
    });
  });
}

const isMarker = (status: string) => (event: AgUiEvent) =>
  event.type === "CUSTOM" &&
  event.name === "harness_run" &&
  (event.value as { status?: string }).status === status;

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authenticated: true,
    session: { user: { rawJWT: "jwt", email: "user@example.test" } },
  });
  runsCreateMock.mockResolvedValue({ run_id: "run_1" });
  runsCancelMock.mockResolvedValue(undefined);
});

describe("POST /api/harness/chat/stream", () => {
  it("tells the browser which harness run it is following, then that it finished", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("run.completed", 1);
    });
    runsGetMock.mockResolvedValue(completedRecord);

    const { events } = await readEvents(await POST(chatRequest()));

    const markers = events.filter((e) => e.type === "CUSTOM");
    expect(markers.map((e) => e.value)).toEqual([
      { runId: "run_1", status: "running" },
      { runId: "run_1", status: "finished" },
    ]);
    expect(events.at(-1)).toEqual({
      type: "RUN_FINISHED",
      runId: "agui-1",
      threadId: "thread-1",
    });
    expect(runsCancelMock).not.toHaveBeenCalled();
  });

  it("stops relaying but leaves the harness run alone when the caller goes away", async () => {
    blockingRun();
    const caller = new AbortController();

    const res = await POST(chatRequest(caller.signal));
    const { reader } = await readEvents(res, isMarker("running"));
    caller.abort();
    while (!(await reader.read()).done) {
      // drain
    }

    expect(runsCancelMock).not.toHaveBeenCalled();
    expect(runsGetMock).not.toHaveBeenCalled();
  });

  it("keeps the run as the thread's active run when the harness stream drops", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("agent.started", 1);
    });

    const { events } = await readEvents(await POST(chatRequest()));

    expect(events.some(isMarker("finished"))).toBe(false);
    expect(events.at(-1)).toEqual({
      type: "RUN_ERROR",
      message: "stream_truncated",
    });
    expect(runsCancelMock).not.toHaveBeenCalled();
  });

  it("reports a failed run as finished", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("run.failed", 1);
    });

    const { events } = await readEvents(await POST(chatRequest()));

    expect(events.some(isMarker("finished"))).toBe(true);
    expect(events.at(-1)).toEqual({ type: "RUN_ERROR", message: "run_failed" });
  });
});

describe("GET /api/harness/chat/runs/[runId]/stream", () => {
  it("relays the run from its first event through to the answer", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("run.started", 0);
      yield harnessEvent("thinking.delta", 1, { delta: "counting" });
      yield harnessEvent("run.completed", 2);
    });
    runsGetMock.mockResolvedValue(completedRecord);

    const res = await RESUME(
      new Request(
        "http://test/api/harness/chat/runs/run_1/stream?threadId=thread-1&runId=agui-2"
      ),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const { events } = await readEvents(res);

    expect(runsStreamMock).toHaveBeenCalledWith("run_1", expect.anything());
    expect(runsCreateMock).not.toHaveBeenCalled();
    expect(events[0]).toEqual({
      type: "RUN_STARTED",
      runId: "agui-2",
      threadId: "thread-1",
    });
    const narration = events
      .filter((e) => e.type === "REASONING_MESSAGE_CONTENT")
      .map((e) => e.delta)
      .join("");
    expect(narration).toContain("counting");
    const answer = events
      .filter((e) => e.type === "TEXT_MESSAGE_CONTENT")
      .map((e) => e.delta)
      .join("");
    expect(answer).toContain("41 trips");
    expect(events.some(isMarker("finished"))).toBe(true);
    expect(events.at(-1)).toEqual({
      type: "RUN_FINISHED",
      runId: "agui-2",
      threadId: "thread-1",
    });
  });

  it("marks a run the harness no longer knows as finished", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield* [];
      throw new MiotHarnessApiError("unknown_run_id", "run_gone");
    });

    const res = await RESUME(
      new Request(
        "http://test/api/harness/chat/runs/run_gone/stream?threadId=thread-1"
      ),
      { params: Promise.resolve({ runId: "run_gone" }) }
    );
    const { events } = await readEvents(res);

    expect(events.some(isMarker("finished"))).toBe(true);
    expect(events.at(-1)).toEqual({
      type: "RUN_ERROR",
      message: "stream_failed",
    });
  });

  it("leaves the harness run alone when the caller goes away", async () => {
    blockingRun();
    const caller = new AbortController();

    const res = await RESUME(
      withSignal(
        new Request(
          "http://test/api/harness/chat/runs/run_1/stream?threadId=thread-1"
        ),
        caller.signal
      ),
      { params: Promise.resolve({ runId: "run_1" }) }
    );
    const { reader } = await readEvents(res, isMarker("running"));
    caller.abort();
    while (!(await reader.read()).done) {
      // drain
    }

    expect(runsCancelMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/harness/chat/runs/[runId]/cancel", () => {
  const cancel = (runId: string) =>
    CANCEL(
      new Request(`http://test/api/harness/chat/runs/${runId}/cancel`, {
        method: "POST",
      }),
      {
        params: Promise.resolve({ runId }),
      }
    );

  it("cancels the harness run", async () => {
    const res = await cancel("run_1");

    expect(res.status).toBe(204);
    expect(runsCancelMock).toHaveBeenCalledWith("run_1", expect.anything());
  });

  it("treats a run that is no longer in flight as stopped", async () => {
    runsCancelMock.mockRejectedValue(
      new MiotHarnessApiError("http_404", "run_1", undefined, 404)
    );

    expect((await cancel("run_1")).status).toBe(204);
  });

  it("rejects an anonymous caller", async () => {
    requireAuthMock.mockResolvedValue({ authenticated: false });

    expect((await cancel("run_1")).status).toBe(401);
    expect(runsCancelMock).not.toHaveBeenCalled();
  });
});

describe("sseResponse", () => {
  afterEach(() => vi.useRealTimers());

  it("writes a keepalive comment while nothing else is sent", async () => {
    vi.useFakeTimers();
    let finish = () => {};
    const res = sseResponse(
      () => new Promise<void>((resolve) => (finish = resolve))
    );
    const reader = res.body!.getReader();

    await vi.advanceTimersByTimeAsync(SSE_KEEPALIVE_MS);
    const { value } = await reader.read();
    finish();

    expect(new TextDecoder().decode(value)).toBe(": keepalive\n\n");
  });
});
