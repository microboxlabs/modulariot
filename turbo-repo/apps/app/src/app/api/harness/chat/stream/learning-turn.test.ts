/**
 * A learning session's turns through the chat relay: `/review` gets the
 * conversation it names, `/layers` and `/diff` get a card, and trainer tool
 * results come back as diff and evaluation cards.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAuthMock = vi.fn();
const runsCreateMock = vi.fn();
const runsGetMock = vi.fn();
const runsStreamMock = vi.fn();

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
      cancel: vi.fn(async () => undefined),
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

function chatRequest(text: string, learning = true): Request {
  return new Request("http://test/api/harness/chat/stream", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      runId: "agui-1",
      threadId: "thread-1",
      state: learning ? { harnessLearning: "true" } : {},
      messages: [{ id: "u1", role: "user", content: text }],
    }),
  });
}

async function readEvents(res: Response): Promise<AgUiEvent[]> {
  const text = await res.text();
  return text
    .split("\n\n")
    .filter((frame) => frame.startsWith("data: "))
    .map((frame) => JSON.parse(frame.slice(6)) as AgUiEvent);
}

function cards(
  events: AgUiEvent[]
): { name: string; args: Record<string, unknown> }[] {
  const names = new Map<string, string>();
  const args = new Map<string, string>();
  for (const e of events) {
    if (e.type === "TOOL_CALL_START")
      names.set(e.toolCallId as string, e.toolCallName as string);
    if (e.type === "TOOL_CALL_ARGS")
      args.set(e.toolCallId as string, e.delta as string);
  }
  return [...names].map(([id, name]) => ({
    name,
    args: JSON.parse(args.get(id) ?? "{}"),
  }));
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  requireAuthMock.mockResolvedValue({
    authenticated: true,
    session: { user: { rawJWT: "jwt", email: "trainer@example.test" } },
  });
  runsCreateMock.mockResolvedValue({ run_id: "run_1" });
  runsStreamMock.mockImplementation(async function* () {
    yield harnessEvent("run.completed", 1);
  });
  runsGetMock.mockResolvedValue({
    run_id: "run_1",
    answer: JSON.stringify([{ type: "markdown", value: "done" }]),
    events: [],
    conversation_id: "thread-1",
    conversation_summary: null,
    context: { model: "m" },
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const transcript = {
  thread_id: "11111111-2222-3333-4444-555555555555",
  title: "Trips today",
  omitted_messages: 2,
  messages: [
    { role: "user", text: "¿Cuántos viajes han sido cargados hoy?", tools: [] },
    {
      role: "assistant",
      text: "No lo sé.",
      tools: [
        {
          name: "gps_query",
          args_summary: "select count(*)",
          result_summary: "0 rows",
        },
      ],
    },
  ],
};

describe("/review in a learning session", () => {
  it("sends the harness the named conversation, delimited, after the instruction", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(transcript), { status: 200 })
    );

    await readEvents(
      await POST(
        chatRequest(
          "/review https://app.example.test/es/share/tok_123 fix the count"
        )
      )
    );

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "http://modulith.test/api/v1/orgs/acme/harness/transcripts/tok_123"
    );
    expect(init.headers.Authorization).toBe("Bearer jwt");
    const message = runsCreateMock.mock.calls[0]![0].message as string;
    expect(
      message.startsWith(
        "/review https://app.example.test/es/share/tok_123 fix the count\n\n"
      )
    ).toBe(true);
    expect(message).toContain(
      "--- BEGIN TRANSCRIPT (thread 11111111-2222-3333-4444-555555555555: Trips today) ---"
    );
    expect(message).toContain("(2 earlier messages left out)");
    expect(message).toContain("[user]\n¿Cuántos viajes han sido cargados hoy?");
    expect(message).toContain("- tool gps_query select count(*) -> 0 rows");
    expect(message.trimEnd().endsWith("--- END TRANSCRIPT ---")).toBe(true);
  });

  it("answers itself when the conversation cannot be found", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 404 }));

    const events = await readEvents(
      await POST(chatRequest("/review 11111111-2222-3333-4444-555555555555"))
    );

    expect(runsCreateMock).not.toHaveBeenCalled();
    const text = events.find((e) => e.type === "TEXT_MESSAGE_CONTENT");
    expect(text?.delta).toBe("harnessChat.learning.review.not_found");
    expect(events.at(-1)?.type).toBe("RUN_FINISHED");
  });

  it("leaves /review alone outside a learning session", async () => {
    await readEvents(await POST(chatRequest("/review abc", false)));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(runsCreateMock.mock.calls[0]![0].message).toBe("/review abc");
  });
});

describe("/layers and /diff", () => {
  it("puts a card before the harness's answer that opens the view", async () => {
    const events = await readEvents(await POST(chatRequest("/layers")));
    expect(cards(events)).toContainEqual({
      name: "show_learning_view",
      args: { view: "layers" },
    });
    expect(runsCreateMock.mock.calls[0]![0].message).toBe("/layers");
  });

  it("does the same for /diff", async () => {
    const events = await readEvents(await POST(chatRequest("/diff")));
    expect(cards(events)).toContainEqual({
      name: "show_learning_view",
      args: { view: "diff" },
    });
  });
});

describe("trainer tool results", () => {
  it("become a diff card for a knowledge write and an evaluation card", async () => {
    const diff =
      "--- a/rules/loaded.md\n+++ b/rules/loaded.md\n@@ -0,0 +1 @@\n+Loaded means sent.\n";
    runsStreamMock.mockImplementation(async function* () {
      yield harnessEvent("tool.started", 1, {
        tool: "ws_write",
        call_id: "c1",
        args: { path: "rules/loaded.md", content: "Loaded means sent.\n" },
      });
      yield harnessEvent("tool.completed", 2, {
        tool: "ws_write",
        call_id: "c1",
        ok: true,
        preview: { layer: "rule", op: "write", diff, version: 1 },
      });
      yield harnessEvent("tool.completed", 3, {
        tool: "run_learning_eval",
        call_id: "c2",
        ok: true,
        preview: {
          evaluation_id: "ev1",
          status: "done",
          summary: {
            baseline_avg: 1,
            candidate_avg: 4,
            improved: 1,
            regressed: 0,
            unchanged: 0,
          },
        },
      });
      yield harnessEvent("run.completed", 4);
    });

    const events = await readEvents(
      await POST(chatRequest("/rule loaded means sent"))
    );
    const shown = cards(events);

    const change = shown.find((c) => c.name === "show_knowledge_change");
    expect(change?.args).toMatchObject({
      tool: "ws_write",
      changes: [
        {
          path: "rules/loaded.md",
          layer: "rule",
          id: "loaded",
          op: "write",
          diff,
          version: 1,
        },
      ],
    });
    const evaluation = shown.find((c) => c.name === "show_learning_eval");
    expect(evaluation?.args).toMatchObject({
      evaluationId: "ev1",
      status: "done",
    });
  });
});
