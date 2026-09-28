import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import { createHarnessHistoryAdapter, stripInlineContent } from "./harness-history-adapter";
import { appendMessage, getThread, listMessages, type StoredThread } from "./harness-thread-store";

vi.mock("./harness-thread-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./harness-thread-store")>()),
  getThread: vi.fn(),
  listMessages: vi.fn(),
  appendMessage: vi.fn(),
}));

const getThreadMock = vi.mocked(getThread);
const listMessagesMock = vi.mocked(listMessages);
const appendMessageMock = vi.mocked(appendMessage);

function storedThread(summary: string | null): StoredThread {
  return {
    id: "thread-1",
    title: "chat",
    summary,
    model: null,
    ownerId: "me",
    owned: true,
    expiresAt: null,
    lastMessageAt: null,
    createdAt: "2026-09-08T12:00:00.000Z",
    updatedAt: "2026-09-08T12:00:00.000Z",
    sharedWith: [],
  };
}

describe("stripInlineContent", () => {
  it("drops an inlined attachment, keeping the message around it", () => {
    const message = {
      id: "m1",
      role: "user",
      content: [
        { type: "text", text: "look at this" },
        {
          type: "file",
          filename: "report.pdf",
          mimeType: "application/pdf",
          data: `data:application/pdf;base64,${"A".repeat(50_000)}`,
        },
      ],
      attachments: [
        {
          name: "report.pdf",
          type: "document",
          content: [
            {
              type: "file",
              filename: "report.pdf",
              mimeType: "application/pdf",
              data: `data:application/pdf;base64,${"A".repeat(50_000)}`,
            },
          ],
        },
      ],
    };

    const stored = stripInlineContent(message);

    // The part goes rather than its body: an emptied file part renders as a
    // link to the current page, and an emptied image as a broken image.
    expect(stored.content).toEqual([{ type: "text", text: "look at this" }]);
    expect(stored.attachments[0]).toEqual({
      name: "report.pdf",
      type: "document",
      content: [{ type: "text", text: "[pdf: report.pdf]" }],
    });
  });

  it("leaves a marker for an inlined image in the attachment", () => {
    const message = {
      content: [{ type: "text", text: "and this?" }],
      attachments: [
        {
          name: "chart.png",
          type: "image",
          contentType: "image/png",
          content: [{ type: "image", image: "data:image/png;base64,iVBO" }],
        },
      ],
    };

    expect(stripInlineContent(message).attachments[0].content).toEqual([
      { type: "text", text: "[image: chart.png]" },
    ]);
  });

  it("keeps a short remote reference, which costs nothing to store", () => {
    const message = { content: [{ type: "image", image: "https://example.test/a.png" }] };

    expect(stripInlineContent(message).content[0].image).toBe("https://example.test/a.png");
  });
});

describe("createHarnessHistoryAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getThreadMock.mockResolvedValue(storedThread(null));
  });

  it("carries the conversation id even when the thread is empty", async () => {
    getThreadMock.mockResolvedValue(null);
    listMessagesMock.mockResolvedValue([]);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toEqual([]);
    expect(loaded.state).toEqual({
      harnessConversationId: "thread-1",
      harnessConversationSummary: null,
    });
  });

  it("falls back to an empty thread when the store cannot be reached", async () => {
    getThreadMock.mockResolvedValue(null);
    listMessagesMock.mockResolvedValue(null);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toEqual([]);
  });

  it("hands back the summary the harness compacted the thread into", async () => {
    getThreadMock.mockResolvedValue(storedThread("so far: trips"));
    listMessagesMock.mockResolvedValue([]);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.state).toEqual({
      harnessConversationId: "thread-1",
      harnessConversationSummary: "so far: trips",
    });
  });

  it("revives the transcript", async () => {
    listMessagesMock.mockResolvedValue([
      {
        id: "m1",
        parentId: null,
        format: "aui-v1",
        payload: {
          id: "m1",
          role: "user",
          content: [{ type: "text", text: "how many trips?" }],
          createdAt: "2026-09-08T12:00:00.000Z",
        },
      },
      {
        id: "m2",
        parentId: "m1",
        format: "aui-v1",
        payload: {
          id: "m2",
          role: "assistant",
          content: [{ type: "text", text: "41 trips" }],
          createdAt: "2026-09-08T12:00:01.000Z",
        },
      },
    ]);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toHaveLength(2);
    // JSON has no date type, and the runtime never coerces the field.
    expect(loaded.messages[0].message.createdAt).toBeInstanceOf(Date);
    expect(loaded.headId).toBe("m2");
  });

  it("skips messages written in a format it does not know", async () => {
    listMessagesMock.mockResolvedValue([
      {
        id: "m1",
        parentId: null,
        format: "aui-v99",
        payload: { id: "m1", role: "user", content: [] },
      },
    ]);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toEqual([]);
  });

  it("stores an appended message under its own id, stripped", async () => {
    appendMessageMock.mockResolvedValue(true);
    const adapter = createHarnessHistoryAdapter("thread-1");

    await adapter.append({
      parentId: "m1",
      message: {
        id: "m2",
        role: "user",
        content: [
          { type: "file", filename: "a.pdf", mimeType: "application/pdf", data: "data:application/pdf;base64,AAAA" },
        ],
      } as unknown as ThreadMessage,
    });

    expect(appendMessageMock).toHaveBeenCalledWith("thread-1", {
      id: "m2",
      parentId: "m1",
      format: "aui-v1",
      payload: expect.objectContaining({ id: "m2", role: "user" }),
    });
    const stored = appendMessageMock.mock.calls[0][1].payload as {
      content: unknown[];
    };
    expect(stored.content).toEqual([]);
  });
});

describe("createHarnessHistoryAdapter with a run in flight", () => {
  const user = {
    id: "m1",
    parentId: null,
    format: "aui-v1",
    payload: { id: "m1", role: "user", content: [{ type: "text", text: "trips?" }] },
  };
  const halfAnswer = (runId: string, status: string) => ({
    id: "m2",
    parentId: "m1",
    format: "aui-v1",
    payload: {
      id: "m2",
      role: "assistant",
      content: [{ type: "text", text: "Thinking" }],
      status: { type: status, reason: "error" },
      metadata: { custom: { harnessRunId: runId } },
    },
  });

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getThreadMock.mockResolvedValue(storedThread(null));
    appendMessageMock.mockResolvedValue(true);
  });

  it("stamps an assistant message with the run that produced it", async () => {
    const runs = { harnessRunId: "run_a" as string | null };
    const adapter = createHarnessHistoryAdapter("thread-1", runs);
    const answer = { id: "m2", role: "assistant", content: [] } as unknown as ThreadMessage;

    await adapter.append({ parentId: "m1", message: answer });
    runs.harnessRunId = "run_b";
    await adapter.update!({ parentId: "m1", message: answer });

    expect(appendMessageMock).toHaveBeenCalledTimes(2);
    for (const [, stored] of appendMessageMock.mock.calls) {
      expect(stored.payload).toMatchObject({ metadata: { custom: { harnessRunId: "run_a" } } });
    }
  });

  it("resumes the thread's active run and drops the answer it left half-written", async () => {
    window.localStorage.setItem("harness-chat.active-run.thread-1", "run_a");
    listMessagesMock.mockResolvedValue([user, halfAnswer("run_a", "incomplete")]);
    const runs = { harnessRunId: null as string | null };
    const adapter = createHarnessHistoryAdapter("thread-1", runs);

    const loaded = await adapter.load();

    expect(loaded.messages.map((item) => item.message.id)).toEqual(["m1"]);
    expect(loaded.headId).toBe("m1");
    expect(adapter.takePendingResume()).toBe("run_a");
    expect(adapter.takePendingResume()).toBeNull();

    // The re-attached run's answer is stored over the half-written one, and
    // what follows it points at the stored id.
    runs.harnessRunId = "run_a";
    await adapter.append({
      parentId: "m1",
      message: { id: "fresh", role: "assistant", content: [] } as unknown as ThreadMessage,
    });
    runs.harnessRunId = null;
    await adapter.append({
      parentId: "fresh",
      message: { id: "m3", role: "user", content: [] } as unknown as ThreadMessage,
    });
    expect(appendMessageMock.mock.calls.map(([, m]) => [m.id, m.parentId])).toEqual([
      ["m2", "m1"],
      ["m3", "m2"],
    ]);
    expect(appendMessageMock.mock.calls[0][1].payload).toMatchObject({ id: "m2" });
  });

  it("resumes from the user message when no half-written answer was stored", async () => {
    window.localStorage.setItem("harness-chat.active-run.thread-1", "run_a");
    listMessagesMock.mockResolvedValue([user]);
    const adapter = createHarnessHistoryAdapter("thread-1");

    const loaded = await adapter.load();

    expect(loaded.headId).toBe("m1");
    expect(adapter.takePendingResume()).toBe("run_a");
  });

  it("forgets a run whose answer was already stored complete", async () => {
    window.localStorage.setItem("harness-chat.active-run.thread-1", "run_a");
    listMessagesMock.mockResolvedValue([user, halfAnswer("run_a", "complete")]);
    const adapter = createHarnessHistoryAdapter("thread-1");

    const loaded = await adapter.load();

    expect(loaded.headId).toBe("m2");
    expect(adapter.takePendingResume()).toBeNull();
    expect(window.localStorage.getItem("harness-chat.active-run.thread-1")).toBeNull();
  });

  it("does not resume a thread with no active run", async () => {
    listMessagesMock.mockResolvedValue([user, halfAnswer("run_a", "incomplete")]);
    const adapter = createHarnessHistoryAdapter("thread-1");

    const loaded = await adapter.load();

    expect(loaded.headId).toBe("m2");
    expect(adapter.takePendingResume()).toBeNull();
  });
});
