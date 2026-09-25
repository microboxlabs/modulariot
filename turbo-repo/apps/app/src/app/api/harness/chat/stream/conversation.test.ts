import { describe, expect, it } from "vitest";
import { conversationOf, priorTurns, type AgUiMessage } from "./conversation";

const user = (id: string, content: unknown): AgUiMessage => ({
  id,
  role: "user",
  content,
});
const assistant = (id: string, content: unknown): AgUiMessage => ({
  id,
  role: "assistant",
  content,
});

describe("priorTurns", () => {
  it("pairs each question with its answer, up to the message being sent", () => {
    const turns = priorTurns([
      user("u1", "how many trips?"),
      assistant("a1", "41"),
      user("u2", "and last week?"),
      assistant("a2", "38"),
      user("u3", "y bueno"),
    ]);

    expect(turns).toEqual([
      { user_message: "how many trips?", assistant_answer: "41" },
      { user_message: "and last week?", assistant_answer: "38" },
    ]);
  });

  it("is empty on the first message of a chat", () => {
    expect(priorTurns([user("u1", "hola")])).toEqual([]);
  });

  it("takes the question the assistant actually answered", () => {
    // The first question got no answer — a failed run leaves nothing behind.
    const turns = priorTurns([
      user("u1", "unanswered"),
      user("u2", "asked again"),
      assistant("a1", "here"),
      user("u3", "next"),
    ]);

    expect(turns).toEqual([{ user_message: "asked again", assistant_answer: "here" }]);
  });

  it("reads the text parts of a message that carried more than text", () => {
    const turns = priorTurns([
      user("u1", [
        { type: "text", text: "look" },
        { type: "binary", mimeType: "image/png", data: "data:..." },
      ]),
      assistant("a1", "a photo"),
      user("u2", "and?"),
    ]);

    expect(turns).toEqual([{ user_message: "look", assistant_answer: "a photo" }]);
  });

  it("ignores narration and tool traffic between the turns", () => {
    const turns = priorTurns([
      user("u1", "q"),
      { id: "r", role: "reasoning", content: "thinking…" },
      { id: "t", role: "tool", content: "{}", toolCallId: "c1" },
      assistant("a1", "a"),
      user("u2", "next"),
    ]);

    expect(turns).toEqual([{ user_message: "q", assistant_answer: "a" }]);
  });

  it("keeps only the most recent twenty", () => {
    const messages: AgUiMessage[] = [];
    for (let i = 0; i < 30; i++) {
      messages.push(user(`u${i}`, `q${i}`), assistant(`a${i}`, `a${i}`));
    }
    messages.push(user("now", "now"));

    const turns = priorTurns(messages);

    expect(turns).toHaveLength(20);
    expect(turns[0].user_message).toBe("q10");
    expect(turns.at(-1)?.assistant_answer).toBe("a29");
  });
});

describe("conversationOf", () => {
  it("falls back to the thread id and carries the stored summary", () => {
    const result = conversationOf(
      {
        threadId: "thread-1",
        state: { harnessConversationSummary: "so far: trips" },
      },
      [user("u1", "q"), assistant("a1", "a"), user("u2", "more")]
    );

    expect(result).toEqual({
      conversationId: "thread-1",
      replayTurns: [{ user_message: "q", assistant_answer: "a" }],
      summary: "so far: trips",
    });
  });

  it("prefers the id the harness echoed back", () => {
    const result = conversationOf(
      { threadId: "thread-1", state: { harnessConversationId: "conv-9" } },
      []
    );

    expect(result.conversationId).toBe("conv-9");
    expect(result.summary).toBeNull();
  });

  it("forwards nothing for a malformed summary", () => {
    const result = conversationOf(
      {
        threadId: "thread-1",
        state: { harnessConversationSummary: { not: "a string" } },
      },
      []
    );

    expect(result.summary).toBeNull();
  });

  it("clips a summary the harness would refuse", () => {
    const result = conversationOf(
      {
        threadId: "thread-1",
        state: { harnessConversationSummary: "s".repeat(9_000) },
      },
      []
    );

    expect(result.summary).toHaveLength(8_000);
  });

  it("sends no history without a conversation to attach it to", () => {
    const result = conversationOf({}, [user("u1", "q"), assistant("a1", "a"), user("u2", "z")]);

    expect(result).toEqual({
      conversationId: null,
      replayTurns: [],
      summary: null,
    });
  });
});
