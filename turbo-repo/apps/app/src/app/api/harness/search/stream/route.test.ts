/**
 * SSE relay tests for the streaming harness search route.
 *
 * Heavy collaborators (auth, tenant scope, the harness client) are mocked at
 * the module level; the tests focus on the relay's own contract: event
 * whitelist forwarding, the search.result frame, auth passthrough, and
 * mid-stream failure degrading to a search.error frame instead of a crash.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const requireAuthMock = vi.fn();
const resolveTenantScopeMock = vi.fn();
const runsCreateMock = vi.fn();
const runsGetMock = vi.fn();
const runsStreamMock = vi.fn();
const runsCancelMock = vi.fn();

vi.mock("../../../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));

vi.mock("../../../utils/tenant-scope", () => ({
  resolveTenantScope: (...args: unknown[]) => resolveTenantScopeMock(...args),
}));

vi.mock("@microboxlabs/miot-harness-client", async (importOriginal) => ({
  // Keep the real exports (parseSSE below reads the route's actual SSE
  // output) and stub only the client factory + terminal set.
  ...(await importOriginal<typeof import("@microboxlabs/miot-harness-client")>()),
  createMiotHarnessClient: () => ({
    runs: {
      create: (...args: unknown[]) => runsCreateMock(...args),
      get: (...args: unknown[]) => runsGetMock(...args),
      stream: (...args: unknown[]) => runsStreamMock(...args),
      cancel: (...args: unknown[]) => runsCancelMock(...args),
    },
  }),
  TERMINAL_EVENT_TYPES: new Set(["run.completed", "run.failed"]),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

type PostHandler = (request: Request) => Promise<Response>;
let POST: PostHandler;

function harnessEvent(type: string, seq: number, data: Record<string, unknown> = {}) {
  return {
    id: `evt_${seq}`,
    run_id: "run_1",
    seq,
    type,
    message: "",
    data,
    created_at: "2026-07-08T00:00:00Z",
  };
}

function searchRequest(query = "estado del servicio 1585735"): Request {
  return new Request("http://test/app/api/harness/search/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

/** Collect the response's SSE frames via the client package's real parser —
 * the same one the browser-side consumer uses, so the test pins the actual
 * wire contract instead of a hand-rolled approximation. */
async function parseFrames(
  res: Response,
): Promise<Array<{ event: string; data: unknown }>> {
  const { parseSSE } = await import("@microboxlabs/miot-harness-client");
  const frames: Array<{ event: string; data: unknown }> = [];
  for await (const frame of parseSSE(res.body!)) {
    frames.push({
      event: frame.event ?? "",
      data: frame.data ? JSON.parse(frame.data) : undefined,
    });
  }
  return frames;
}

beforeEach(async () => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.MIOT_MODULITH_URL = "http://modulith.test";
  ({ POST } = await import("./route"));

  requireAuthMock.mockResolvedValue({
    authenticated: true,
    session: { user: { rawJWT: "jwt", email: "user@test" } },
  });
  resolveTenantScopeMock.mockResolvedValue({
    resolved: true,
    scope: { activeOrg: { slug: "mintral" } },
  });
  runsCreateMock.mockResolvedValue({ run_id: "run_1" });
});

describe("POST /api/harness/search/stream", () => {
  it("relays whitelisted events and finishes with search.result", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("route.selected", 1, { route: "data_agentic" });
      yield harnessEvent("usage.recorded", 2, { model: "x" }); // must be filtered
      yield harnessEvent("tool.started", 3, { tool: "acs_query" });
      yield harnessEvent("tool.completed", 4, { tool: "acs_query" });
      yield harnessEvent("thinking.delta", 5, { delta: "The evidence" });
      yield harnessEvent("answer.completed", 6, { length: 10 });
      yield harnessEvent("run.completed", 7);
    });
    runsGetMock.mockResolvedValue({
      answer: JSON.stringify([
        { type: "intent", value: "ask" },
        { type: "markdown", value: "**Servicio 1585735** — activo" },
        { type: "url", value: { url: "/delivery?service=1585735", name: "Delivery" } },
      ]),
    });

    const res = await POST(searchRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/event-stream");

    const frames = await parseFrames(res);
    const names = frames.map((f) => f.event);
    expect(names[0]).toBe("search.accepted");
    expect(names).toEqual(
      expect.arrayContaining([
        "route.selected",
        "tool.started",
        "tool.completed",
        "thinking.delta",
        "answer.completed",
        "run.completed",
        "search.result",
      ]),
    );
    expect(names).not.toContain("usage.recorded");
    // search.result is the last frame and carries the buffered-route shape.
    expect(names.at(-1)).toBe("search.result");
    const result = frames.at(-1)?.data as {
      results: Array<{ id: string; intent?: string; blocks: unknown[] }>;
    };
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe("harness:run_1");
    expect(result.results[0].intent).toBe("ask");
    expect(result.results[0].blocks).toHaveLength(2); // intent block folded into field
  });

  it("returns the auth response untouched when unauthenticated", async () => {
    requireAuthMock.mockResolvedValue({
      authenticated: false,
      response: new Response(null, { status: 401 }),
    });

    const res = await POST(searchRequest());
    expect(res.status).toBe(401);
    expect(runsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects an empty query with 400 before creating a run", async () => {
    const res = await POST(searchRequest("   "));
    expect(res.status).toBe(400);
    expect(runsCreateMock).not.toHaveBeenCalled();
  });

  it("emits search.error, cancels the run, and still terminates when the relay fails mid-run", async () => {
    runsCancelMock.mockResolvedValue(undefined);
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("route.selected", 1);
      throw new Error("upstream died");
    });

    const res = await POST(searchRequest());
    const frames = await parseFrames(res);
    const names = frames.map((f) => f.event);
    expect(names).toContain("route.selected");
    expect(names.at(-1)).toBe("search.error");
    expect(names).not.toContain("search.result");
    // Nobody can consume the run's answer anymore — it must be cancelled.
    expect(runsCancelMock).toHaveBeenCalledWith("run_1", expect.anything());
  });

  it("cancels the upstream run when the consumer disconnects mid-run", async () => {
    runsCancelMock.mockResolvedValue(undefined);
    runsStreamMock.mockImplementation(async function* (
      _id: string,
      opts: { signal: AbortSignal },
    ) {
      yield harnessEvent("route.selected", 1);
      // Block like a live run until the relay aborts us (client.runs.stream
      // honors the signal the route passes in).
      await new Promise((_, reject) => {
        opts.signal.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });

    const res = await POST(searchRequest());
    const reader = res.body!.getReader();
    await reader.read(); // search.accepted / first frames
    await reader.cancel(); // spotlight dismissed

    expect(runsCancelMock).toHaveBeenCalledWith("run_1", expect.anything());
    expect(runsGetMock).not.toHaveBeenCalled();
  });

  it("does NOT cancel a run that finished on its own", async () => {
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("run.completed", 1);
    });
    runsGetMock.mockResolvedValue({ answer: "[]" });

    const res = await POST(searchRequest());
    await res.text(); // drain to completion
    expect(runsCancelMock).not.toHaveBeenCalled();
  });
});
