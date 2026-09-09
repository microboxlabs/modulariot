import { describe, expect, it } from "vitest";
import type { RunAgentInput } from "@ag-ui/client";
import { trimRunInput } from "./harness-run-agent";

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

    expect(trimmed.messages.map((m) => m.role)).toEqual(["user", "assistant", "tool"]);
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
