import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RunAgentInput } from "@ag-ui/client";
import {
  HarnessRunAgent,
  trimRunInput,
  withEffort,
  withModel,
} from "./harness-run-agent";

function input(messages: RunAgentInput["messages"]): RunAgentInput {
  return {
    threadId: "t1",
    runId: "r1",
    state: null,
    messages,
    tools: [],
    context: [],
    forwardedProps: {},
  };
}

describe("trimRunInput", () => {
  it("drops the narration and keeps the exchange", () => {
    const trimmed = trimRunInput(
      input([
        { id: "u1", role: "user", content: "how many trips?" },
        { id: "r1", role: "reasoning", content: "Conectando con el harness…" },
        { id: "a1", role: "assistant", content: "41" },
        { id: "act", role: "activity", activityType: "x", content: {} },
        { id: "u2", role: "user", content: "and last week?" },
      ])
    );

    expect(trimmed.messages.map((m) => m.id)).toEqual(["u1", "a1", "u2"]);
  });

  it("sends only the text of a message that carried an attachment", () => {
    const trimmed = trimRunInput(
      input([
        {
          id: "u1",
          role: "user",
          content: [
            { type: "text", text: "look at this" },
            {
              type: "binary",
              mimeType: "application/pdf",
              data: `data:application/pdf;base64,${"A".repeat(50_000)}`,
            },
          ],
        },
      ])
    );

    expect(trimmed.messages[0].content).toBe("look at this");
  });

  it("keeps the tool exchange that steers a run", () => {
    const trimmed = trimRunInput(
      input([
        { id: "u1", role: "user", content: "pick one" },
        {
          id: "a1",
          role: "assistant",
          content: "",
          toolCalls: [
            {
              id: "c1",
              type: "function",
              function: { name: "ask", arguments: "{}" },
            },
          ],
        },
        { id: "t1", role: "tool", content: "option b", toolCallId: "c1" },
      ])
    );

    expect(trimmed.messages.map((m) => m.role)).toEqual([
      "user",
      "assistant",
      "tool",
    ]);
  });

  it("keeps only the recent part of a long transcript", () => {
    const messages: RunAgentInput["messages"] = [];
    for (let i = 0; i < 100; i++) {
      messages.push({ id: `u${i}`, role: "user", content: `q${i}` });
      messages.push({ id: `a${i}`, role: "assistant", content: `a${i}` });
    }

    const trimmed = trimRunInput(input(messages));

    expect(trimmed.messages).toHaveLength(60);
    expect(trimmed.messages.at(-1)?.id).toBe("a99");
  });
});

describe("withModel", () => {
  it("puts the picked model in state next to the conversation fields", () => {
    const base = { ...input([]), state: { harnessConversationId: "t1" } };
    expect(withModel(base, "claude-sonnet-4-6").state).toEqual({
      harnessConversationId: "t1",
      harnessModel: "claude-sonnet-4-6",
    });
  });

  it("leaves the input alone when no model is picked", () => {
    const base = input([]);
    expect(withModel(base, null)).toBe(base);
  });

  it("drops a previously picked model when the default is chosen again", () => {
    const base = {
      ...input([]),
      state: { harnessConversationId: "t1", harnessModel: "claude-sonnet-4-6" },
    };
    expect(withModel(base, null).state).toEqual({
      harnessConversationId: "t1",
    });
  });
});

describe("withEffort", () => {
  it("puts the picked effort in state next to the model", () => {
    const base = withModel(
      { ...input([]), state: { harnessConversationId: "t1" } },
      "m"
    );
    expect(withEffort(base, "max").state).toEqual({
      harnessConversationId: "t1",
      harnessModel: "m",
      harnessEffort: "max",
    });
  });

  it("drops the effort when the default is chosen again", () => {
    const base = { ...input([]), state: { harnessEffort: "low" } };
    expect(withEffort(base, null).state).toEqual({});
    expect(withEffort(input([]), null)).toEqual(input([]));
  });
});

function sseBody(events: Record<string, unknown>[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
}

const MARKER_KEY = "harness-chat.active-run.t1";

describe("HarnessRunAgent run tracking", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("remembers the harness run while it runs and forgets it once it is over", async () => {
    const seen: (string | null)[] = [];
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      sseBody([
        { type: "RUN_STARTED", runId: "r1", threadId: "t1" },
        { type: "CUSTOM", name: "harness_run", value: { runId: "run_a", status: "running" } },
        { type: "CUSTOM", name: "probe", value: null },
        { type: "CUSTOM", name: "harness_run", value: { runId: "run_a", status: "finished" } },
        { type: "RUN_FINISHED", runId: "r1", threadId: "t1" },
      ])
    );
    const agent = new HarnessRunAgent({ url: "/api/harness/chat/stream", threadId: "t1", fetch });
    agent.subscribe({
      onCustomEvent: ({ event }) => {
        if (event.name === "probe") seen.push(window.localStorage.getItem(MARKER_KEY));
      },
    });

    await agent.runAgent({ runId: "r1" });

    expect(fetch.mock.calls[0][1].method).toBe("POST");
    expect(seen).toEqual(["run_a"]);
    expect(agent.harnessRunId).toBe("run_a");
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull();
  });

  it("re-attaches to a harness run instead of starting one", async () => {
    const fetch = vi.fn<(url: string, init: RequestInit) => Promise<Response>>(async () =>
      sseBody([
        { type: "RUN_STARTED", runId: "r2", threadId: "t1" },
        { type: "RUN_FINISHED", runId: "r2", threadId: "t1" },
      ])
    );
    const agent = new HarnessRunAgent({ url: "/api/harness/chat/stream", threadId: "t1", fetch });
    agent.resumeRunId = "run_a";

    await agent.runAgent({ runId: "r2" });

    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("/api/harness/chat/runs/run_a/stream?threadId=t1&runId=r2");
    expect(init.method).toBe("GET");
    expect(agent.resumeRunId).toBeNull();
    expect(agent.harnessRunId).toBe("run_a");
  });

  it("cancels the harness run on Stop and forgets it", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    window.localStorage.setItem(MARKER_KEY, "run_a");
    const agent = new HarnessRunAgent({ url: "/api/harness/chat/stream", threadId: "t1" });
    agent.harnessRunId = "run_a";

    agent.cancelHarnessRun();

    expect(fetch).toHaveBeenCalledWith("/api/harness/chat/runs/run_a/cancel", { method: "POST" });
    expect(window.localStorage.getItem(MARKER_KEY)).toBeNull();
  });
});
