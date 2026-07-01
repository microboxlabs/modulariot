import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { AssistantTurn } from "../../transcript/AssistantTurn.js";
import type { TranscriptItem } from "../../session/types.js";

function assistant(
  text: string,
  status: "streaming" | "complete" | "failed",
): Extract<TranscriptItem, { kind: "assistant" }> {
  return { kind: "assistant", id: "a-1", runId: "r1", text, status, ts: "t" };
}

describe("<AssistantTurn />", () => {
  it("renders a markdown list bullet when complete", () => {
    const { lastFrame } = render(
      <AssistantTurn item={assistant("- one\n- two", "complete")} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("•");
    expect(frame).toContain("one");
  });

  it("renders raw text (no bullet) while streaming", () => {
    const { lastFrame } = render(
      <AssistantTurn item={assistant("- one\n- two", "streaming")} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("- one");
    expect(frame).not.toContain("•");
  });
});
