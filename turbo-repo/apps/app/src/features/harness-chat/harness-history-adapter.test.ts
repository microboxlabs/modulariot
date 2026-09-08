import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ThreadMessage } from "@assistant-ui/react";
import {
  activeBranch,
  createHarnessHistoryAdapter,
  stripInlineContent,
  toReplayTurns,
} from "./harness-history-adapter";
import { appendMessage, listMessages } from "./harness-thread-store";

vi.mock("./harness-thread-store", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./harness-thread-store")>()),
  listMessages: vi.fn(),
  appendMessage: vi.fn(),
}));

const listMessagesMock = vi.mocked(listMessages);
const appendMessageMock = vi.mocked(appendMessage);

function userMessage(id: string, text: string) {
  return {
    id,
    role: "user",
    content: [{ type: "text", text }],
    createdAt: new Date("2026-09-08T12:00:00Z"),
  } as unknown as ThreadMessage;
}

function assistantMessage(id: string, text: string) {
  return {
    id,
    role: "assistant",
    content: [{ type: "text", text }],
    createdAt: new Date("2026-09-08T12:00:01Z"),
  } as unknown as ThreadMessage;
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

describe("activeBranch", () => {
  it("follows the head back to the root, ignoring abandoned forks", () => {
    const items = [
      { parentId: null, message: userMessage("m1", "first question") },
      { parentId: "m1", message: assistantMessage("m2", "first answer") },
      // The user edited m1: m3 forks from the same parent and m4 answers it.
      { parentId: null, message: userMessage("m3", "edited question") },
      { parentId: "m3", message: assistantMessage("m4", "second answer") },
    ];

    const branch = activeBranch(items, "m4").map((m) => m.id);

    expect(branch).toEqual(["m3", "m4"]);
  });

  it("is empty without a head", () => {
    expect(activeBranch([], null)).toEqual([]);
  });
});

describe("toReplayTurns", () => {
  it("pairs each question with the answer that followed it", () => {
    const turns = toReplayTurns([
      userMessage("m1", "how many trips yesterday?"),
      assistantMessage("m2", "41 trips"),
      userMessage("m3", "and last week?"),
      assistantMessage("m4", "263 trips"),
    ]);

    expect(turns).toEqual([
      { user_message: "how many trips yesterday?", assistant_answer: "41 trips" },
      { user_message: "and last week?", assistant_answer: "263 trips" },
    ]);
  });

  it("takes the question the assistant actually answered", () => {
    const turns = toReplayTurns([
      userMessage("m1", "ignore me"),
      userMessage("m2", "answer me"),
      assistantMessage("m3", "here you go"),
    ]);

    expect(turns).toEqual([{ user_message: "answer me", assistant_answer: "here you go" }]);
  });

  it("keeps only the most recent turns", () => {
    const messages = Array.from({ length: 10 }, (_, i) => [
      userMessage(`u${i}`, `q${i}`),
      assistantMessage(`a${i}`, `a${i}`),
    ]).flat();

    const turns = toReplayTurns(messages, 3);

    expect(turns.map((t) => t.user_message)).toEqual(["q7", "q8", "q9"]);
  });
});

describe("createHarnessHistoryAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carries the conversation id even when the thread is empty", async () => {
    listMessagesMock.mockResolvedValue([]);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toEqual([]);
    expect(loaded.state).toEqual({
      harnessConversationId: "thread-1",
      harnessReplayTurns: [],
    });
  });

  it("falls back to an empty thread when the store cannot be reached", async () => {
    listMessagesMock.mockResolvedValue(null);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toEqual([]);
  });

  it("revives the transcript and the context the harness may have lost", async () => {
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
    expect(loaded.state).toEqual({
      harnessConversationId: "thread-1",
      harnessReplayTurns: [
        { user_message: "how many trips?", assistant_answer: "41 trips" },
      ],
    });
  });

  it("replays only the branch the thread ended on", async () => {
    const row = (id: string, parentId: string | null, role: string, text: string) => ({
      id,
      parentId,
      format: "aui-v1",
      payload: {
        id,
        role,
        content: [{ type: "text", text }],
        createdAt: "2026-09-08T12:00:00.000Z",
      },
    });
    listMessagesMock.mockResolvedValue([
      row("m1", null, "user", "first question"),
      row("m2", "m1", "assistant", "first answer"),
      row("m3", null, "user", "edited question"),
      row("m4", "m3", "assistant", "second answer"),
    ]);

    const loaded = await createHarnessHistoryAdapter("thread-1").load();

    expect(loaded.messages).toHaveLength(4);
    expect(loaded.state).toEqual({
      harnessConversationId: "thread-1",
      harnessReplayTurns: [
        { user_message: "edited question", assistant_answer: "second answer" },
      ],
    });
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
