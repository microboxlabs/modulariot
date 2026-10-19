import { describe, expect, it } from "vitest";
import {
  conversationOf,
  effortOf,
  lastUserAttachments,
  NO_ANSWER,
  priorTurns,
  type AgUiMessage,
} from "./conversation";

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

  it("keeps a question that got no answer, marked as such", () => {
    // The first question got no answer — a failed run leaves nothing behind.
    const turns = priorTurns([
      user("u1", "unanswered"),
      user("u2", "asked again"),
      assistant("a1", "here"),
      user("u3", "next"),
    ]);

    expect(turns).toEqual([
      { user_message: "unanswered", assistant_answer: NO_ANSWER },
      { user_message: "asked again", assistant_answer: "here" },
    ]);
  });

  it("keeps an unanswered question right before the current one", () => {
    // Dev, 2026-09-28: the first question's run never finished and the
    // follow-up "me respondes?" reached the model with no history at all.
    const turns = priorTurns([
      user("u1", "/selectables cuantos seleccionables existen actualmente"),
      user("u2", "me respondes?"),
    ]);

    expect(turns).toEqual([
      {
        user_message: "/selectables cuantos seleccionables existen actualmente",
        assistant_answer: NO_ANSWER,
      },
    ]);
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

describe("lastUserAttachments", () => {
  const image = {
    type: "image",
    source: { type: "data", value: "iVBO", mimeType: "image/png" },
    metadata: { filename: "chart.png" },
  };
  const pdf = {
    type: "document",
    source: { type: "data", value: "JVBE", mimeType: "application/pdf" },
  };

  it("collects the files of the message being sent, and only those", () => {
    const attachments = lastUserAttachments([
      user("u1", [{ type: "text", text: "old" }, image]),
      assistant("a1", "ok"),
      user("u2", [{ type: "text", text: "what now?" }, image, pdf]),
    ]);

    expect(attachments).toEqual([
      { mime: "image/png", name: "chart.png", data: "iVBO" },
      { mime: "application/pdf", name: "document.pdf", data: "JVBE" },
    ]);
  });

  it("strips a data URL down to its base64 body", () => {
    const attachments = lastUserAttachments([
      user("u1", [
        {
          type: "binary",
          mimeType: "image/jpeg",
          data: "data:image/jpeg;base64,/9j/",
          filename: "a.jpg",
        },
      ]),
    ]);

    expect(attachments).toEqual([{ mime: "image/jpeg", name: "a.jpg", data: "/9j/" }]);
  });

  it("ignores URL sources, malformed parts and text-only messages", () => {
    expect(
      lastUserAttachments([
        user("u1", [
          { type: "image", source: { type: "url", value: "https://example.com/a.png" } },
          { type: "document", source: { type: "data", value: 1, mimeType: "application/pdf" } },
          { type: "binary", mimeType: "image/png" },
          null,
        ]),
      ])
    ).toEqual([]);
    expect(lastUserAttachments([user("u1", "hola")])).toEqual([]);
  });

  it("leaves a marker for a file in a replayed turn", () => {
    const turns = priorTurns([
      user("u1", [{ type: "text", text: "what is this?" }, image]),
      assistant("a1", "a chart"),
      user("u2", "thanks"),
    ]);

    expect(turns).toEqual([
      { user_message: "[image: chart.png]\nwhat is this?", assistant_answer: "a chart" },
    ]);
  });
});

describe("effortOf", () => {
  it("passes a known effort and drops anything else", () => {
    expect(effortOf({ state: { harnessEffort: "max" } })).toBe("max");
    expect(effortOf({ state: { harnessEffort: "low" } })).toBe("low");
    expect(effortOf({ state: { harnessEffort: "extreme" } })).toBeNull();
    expect(effortOf({ state: { harnessEffort: 3 } })).toBeNull();
    expect(effortOf({ state: null })).toBeNull();
    expect(effortOf({})).toBeNull();
  });
});
