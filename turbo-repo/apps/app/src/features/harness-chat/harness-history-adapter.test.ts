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
      content: [],
    });
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
