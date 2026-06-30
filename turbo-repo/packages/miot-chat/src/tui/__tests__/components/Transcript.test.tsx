import { describe, expect, it } from "vitest";
import { render } from "ink-testing-library";
import { Transcript } from "../../transcript/Transcript.js";
import type { TranscriptItem } from "../../session/types.js";

function ts(s: string): string {
  return s;
}

function user(text: string, id = "u-1"): TranscriptItem {
  return { kind: "user", id, text, ts: ts("t1") };
}

function tool(
  name: string,
  status: "running" | "ok" | "failed",
  id = "t-1",
  message: string | null = null,
): TranscriptItem {
  return { kind: "tool", id, name, status, message, ts: ts("t2") };
}

function assistant(
  text: string,
  status: "streaming" | "complete" | "failed" = "complete",
  id = "a-1",
  runId = "r1",
): TranscriptItem {
  return { kind: "assistant", id, runId, text, status, ts: ts("t3") };
}

describe("<Transcript />", () => {
  it("renders an empty box when there are no items", () => {
    const { lastFrame } = render(
      <Transcript items={[]} isStreaming={false} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame.trim()).toBe("");
  });

  it("renders user + tool + assistant items for a completed turn", () => {
    const items: TranscriptItem[] = [
      user("what is stock?"),
      tool("stock_lookup", "ok"),
      assistant("12 SKUs across 3 warehouses", "complete"),
    ];
    const { lastFrame } = render(
      <Transcript items={items} isStreaming={false} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("what is stock?");
    expect(frame).toContain("stock_lookup");
    expect(frame).toContain("12 SKUs across 3 warehouses");
  });

  it("renders a failed tool's message", () => {
    const items: TranscriptItem[] = [
      user("p"),
      tool("rate_limit", "failed", "t-fail", "429 too many requests"),
    ];
    const { lastFrame } = render(
      <Transcript items={items} isStreaming={false} />,
    );
    expect(lastFrame() ?? "").toContain("429 too many requests");
  });

  it("renders freshness warnings and route labels", () => {
    const items: TranscriptItem[] = [
      { kind: "freshness", id: "f", message: "30d stale", ts: "t" },
      { kind: "route", id: "r", route: "NEXO_QUERY", ts: "t" },
    ];
    const { lastFrame } = render(
      <Transcript items={items} isStreaming={false} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("30d stale");
    expect(frame).toContain("NEXO_QUERY");
  });

  it("renders an in-flight turn (assistant still streaming)", () => {
    const items: TranscriptItem[] = [
      user("hello"),
      assistant("partial answer", "streaming"),
    ];
    const { lastFrame } = render(
      <Transcript items={items} isStreaming={true} />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("hello");
    expect(frame).toContain("partial answer");
  });

  it("keeps a streaming assistant out of Static, then commits it on completion", () => {
    const streamingItems: TranscriptItem[] = [
      user("hi", "u-9"),
      assistant("partial", "streaming", "a-9"),
    ];
    const { rerender, lastFrame } = render(
      <Transcript items={streamingItems} isStreaming={true} />,
    );
    expect(lastFrame() ?? "").toContain("partial");

    const doneItems: TranscriptItem[] = [
      user("hi", "u-9"),
      assistant("partial complete answer", "complete", "a-9"),
    ];
    rerender(<Transcript items={doneItems} isStreaming={false} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("hi");
    expect(frame).toContain("partial complete answer");
  });

  it("flushes the live tail back into the static section when streaming ends", () => {
    const items: TranscriptItem[] = [
      user("hi"),
      tool("looker", "ok"),
      assistant("done", "complete"),
    ];
    // First render in streaming mode → both static + live populated
    const { rerender, lastFrame } = render(
      <Transcript items={items} isStreaming={true} />,
    );
    expect(lastFrame() ?? "").toContain("done");
    // Re-render with isStreaming=false — everything should be in Static now
    rerender(<Transcript items={items} isStreaming={false} />);
    expect(lastFrame() ?? "").toContain("done");
  });
});
