import { describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import {
  RunsPicker,
  summarizeRuns,
  type RunSummary,
} from "../../modals/RunsPicker.js";
import { runsCommand } from "../../slash/handlers/runs.js";
import { initialSession, reduce } from "../../session/reducer.js";
import type { ReducerContext } from "../../session/types.js";
import type {
  HarnessEvent,
  HarnessEventType,
} from "@microboxlabs/miot-harness-client";

function mkCtx(): ReducerContext {
  let n = 0;
  let i = 0;
  return {
    now: () => `2026-01-01T00:00:${String(n++).padStart(2, "0")}Z`,
    uuid: () => `id-${++i}`,
  };
}

function evt(
  type: HarnessEventType,
  overrides: Partial<HarnessEvent> = {},
): HarnessEvent {
  return {
    id: overrides.id ?? `e_${type}`,
    run_id: overrides.run_id ?? "r1",
    seq: overrides.seq ?? 1,
    type,
    message: overrides.message ?? "",
    data: overrides.data ?? {},
    created_at: overrides.created_at ?? "2026-01-01T00:00:00Z",
  };
}

function run(
  id: string,
  prompt: string | null,
  status: "complete" | "streaming" | "failed" | "unknown" = "complete",
): RunSummary {
  return { runId: id, prompt, status };
}

describe("<RunsPicker /> — empty", () => {
  it("shows a (no runs in this session) hint", () => {
    const { lastFrame } = render(
      <RunsPicker
        runs={[]}
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(lastFrame() ?? "").toContain("no runs");
  });

  it("Esc still triggers onCancel when empty", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <RunsPicker
        runs={[]}
        onSelect={() => undefined}
        onCancel={onCancel}
      />,
    );
    stdin.write("\x1b");
    await new Promise((r) => setTimeout(r, 50));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe("<RunsPicker /> — list", () => {
  function seed(): RunSummary[] {
    return [
      run("run-aaa", "what is in stock?"),
      run("run-bbb", "show inventory", "failed"),
      run("run-ccc", null, "streaming"),
    ];
  }

  it("renders one row per run with prompt + status glyph", () => {
    const { lastFrame } = render(
      <RunsPicker
        runs={seed()}
        onSelect={() => undefined}
        onCancel={() => undefined}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("run-aaa");
    expect(frame).toContain("what is in stock?");
    expect(frame).toContain("✓");
    expect(frame).toContain("run-bbb");
    expect(frame).toContain("✗");
    expect(frame).toContain("run-ccc");
    expect(frame).toContain("(no prompt)");
  });

  it("Enter selects the first run", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <RunsPicker
        runs={seed()}
        onSelect={onSelect}
        onCancel={() => undefined}
      />,
    );
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("run-aaa");
  });

  it("Arrow Down + Enter selects the second run", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <RunsPicker
        runs={seed()}
        onSelect={onSelect}
        onCancel={() => undefined}
      />,
    );
    stdin.write("\x1b[B");
    await new Promise((r) => setTimeout(r, 30));
    stdin.write("\r");
    await Promise.resolve();
    expect(onSelect).toHaveBeenCalledWith("run-bbb");
  });
});

describe("summarizeRuns", () => {
  it("returns empty for a session with no assistant items", () => {
    const ctx = mkCtx();
    const s = initialSession(
      {
        tenantId: "t",
        userId: "u",
        mode: "auto",
        baseUrl: "http://x",
      },
      ctx,
    );
    expect(summarizeRuns(s)).toEqual([]);
  });

  it("emits one RunSummary per unique runId, newest-first", () => {
    const ctx = mkCtx();
    let s = initialSession(
      {
        tenantId: "t",
        userId: "u",
        mode: "auto",
        baseUrl: "http://x",
      },
      ctx,
    );
    s = reduce(s, { kind: "BEGIN_TURN", prompt: "first" }, ctx);
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "A" } }),
        runId: "r-1",
      },
      ctx,
    );
    s = reduce(s, { kind: "END_TURN", record: undefined }, ctx);
    s = reduce(s, { kind: "BEGIN_TURN", prompt: "second" }, ctx);
    s = reduce(
      s,
      {
        kind: "STREAM_EVENT",
        event: evt("answer.completed", { data: { text: "B" } }),
        runId: "r-2",
      },
      ctx,
    );

    const summaries = summarizeRuns(s);
    expect(summaries.map((r) => r.runId)).toEqual(["r-2", "r-1"]);
    expect(summaries[0]?.prompt).toBe("second");
    expect(summaries[1]?.prompt).toBe("first");
    expect(summaries[1]?.status).toBe("complete");
  });
});

describe("/runs handler", () => {
  it("returns the runs modal directive", async () => {
    const r = await runsCommand.handle([], {});
    expect(r.modal).toEqual({ kind: "runs" });
  });
});
