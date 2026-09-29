import { describe, expect, it } from "vitest";
import type { SharedMessage } from "./share-links-api";
import { toTranscript } from "./transcript";

function message(
  seq: number,
  payload: Record<string, unknown>,
  format = "aui-v1",
  parentId: string | null = null
): SharedMessage {
  return {
    id: `m${seq}`,
    parentId,
    format,
    payload,
    seq,
    createdAt: null,
  };
}

describe("toTranscript", () => {
  it("keeps user and assistant turns in append order", () => {
    const entries = toTranscript([
      message(2, {
        role: "assistant",
        content: [{ type: "text", text: "Hi there" }],
      }),
      message(1, { role: "user", content: [{ type: "text", text: "Hello" }] }),
    ]);
    expect(entries.map((e) => [e.role, e.parts])).toEqual([
      ["user", [{ kind: "text", text: "Hello" }]],
      ["assistant", [{ kind: "text", text: "Hi there" }]],
    ]);
  });

  it("keeps each tool call with its args and stored result", () => {
    const artifact = {
      kind: "mermaid",
      title: "Flow",
      content: "graph TD; A-->B",
    };
    const [entry] = toTranscript([
      message(1, {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "c1",
            toolName: "show_artifact",
            args: artifact,
            result: {},
          },
          {
            type: "tool-call",
            toolCallId: "c2",
            toolName: "ask_user_question",
            args: { question: "Which?", options: [] },
            result: { error: "cancelled" },
            isError: true,
          },
          { type: "reasoning", text: "thinking" },
        ],
      }),
    ]);
    expect(entry.parts).toEqual([
      {
        kind: "tool",
        id: "c1",
        name: "show_artifact",
        title: "Flow",
        args: artifact,
        result: {},
        isError: false,
      },
      {
        kind: "tool",
        id: "c2",
        name: "ask_user_question",
        title: null,
        args: { question: "Which?", options: [] },
        result: { error: "cancelled" },
        isError: true,
      },
    ]);
  });

  it("shows one copy of a question resent after a failed run", () => {
    // The failed attempt and the resend are siblings under the same parent;
    // only the resend is on the branch that reaches the newest message.
    const ask = { role: "user", content: [{ type: "text", text: "Which?" }] };
    const entries = toTranscript([
      message(1, { role: "user", content: [{ type: "text", text: "hi" }] }),
      message(
        2,
        { role: "assistant", content: [{ type: "text", text: "Hello" }] },
        "aui-v1",
        "m1"
      ),
      message(3, ask, "aui-v1", "m2"),
      message(
        4,
        {
          role: "assistant",
          content: [],
          status: { type: "incomplete", reason: "error" },
        },
        "aui-v1",
        "m3"
      ),
      message(5, ask, "aui-v1", "m2"),
      message(
        6,
        { role: "assistant", content: [{ type: "text", text: "North" }] },
        "aui-v1",
        "m5"
      ),
    ]);
    expect(entries.map((e) => e.id)).toEqual(["m1", "m2", "m5", "m6"]);
  });

  it("keeps a question the user asked again after an answer", () => {
    const ask = { role: "user", content: [{ type: "text", text: "Again?" }] };
    const answer = {
      role: "assistant",
      content: [{ type: "text", text: "Yes" }],
    };
    const entries = toTranscript([
      message(1, ask),
      message(2, answer, "aui-v1", "m1"),
      message(3, ask, "aui-v1", "m2"),
      message(4, answer, "aui-v1", "m3"),
    ]);
    expect(entries.map((e) => e.id)).toEqual(["m1", "m2", "m3", "m4"]);
  });

  it("lists attachment names on a user turn", () => {
    const [entry] = toTranscript([
      message(1, {
        role: "user",
        attachments: [{ name: "report.pdf" }],
        content: [{ type: "text", text: "See this" }],
      }),
    ]);
    expect(entry.parts[0]).toEqual({ kind: "attachment", name: "report.pdf" });
  });

  it("drops unknown formats, other roles and empty turns", () => {
    expect(
      toTranscript([
        message(
          1,
          { role: "user", content: [{ type: "text", text: "x" }] },
          "other-v9"
        ),
        message(2, { role: "system", content: [{ type: "text", text: "x" }] }),
        message(3, {
          role: "assistant",
          content: [{ type: "text", text: "  " }],
        }),
      ])
    ).toEqual([]);
  });
});
