import { describe, expect, it } from "vitest";
import type { SharedMessage } from "./share-links-api";
import { toTranscript } from "./transcript";

function message(
  seq: number,
  payload: Record<string, unknown>,
  format = "aui-v1"
): SharedMessage {
  return {
    id: `m${seq}`,
    parentId: null,
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

  it("names the tools the assistant used, with a title when the args carry one", () => {
    const [entry] = toTranscript([
      message(1, {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolName: "show_dashlet",
            args: { title: "Trips by lane" },
          },
          { type: "tool-call", toolName: "query", args: {} },
          { type: "reasoning", text: "thinking" },
        ],
      }),
    ]);
    expect(entry.parts).toEqual([
      { kind: "tool", name: "show_dashlet", title: "Trips by lane" },
      { kind: "tool", name: "query", title: null },
    ]);
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
