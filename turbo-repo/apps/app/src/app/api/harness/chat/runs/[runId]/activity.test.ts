import { describe, expect, it } from "vitest";
import type {
  HarnessEvent,
  HarnessRunRecord,
} from "@microboxlabs/miot-harness-client";
import { mapRunActivity } from "./activity";

let seq = 0;
const at = (s: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, s)).toISOString();

function ev(
  type: string,
  second: number,
  data: Record<string, unknown> = {}
): HarnessEvent {
  seq += 1;
  return {
    id: `evt_${seq}`,
    run_id: "run_1",
    seq,
    type: type as HarnessEvent["type"],
    message: "",
    data,
    created_at: at(second),
  };
}

function record(events: HarnessEvent[]): HarnessRunRecord {
  return {
    run_id: "run_1",
    status: "completed",
    events,
    artifacts: [],
    answer: "ok",
    conversation_id: null,
  } as HarnessRunRecord;
}

const tr = (key: string) => `t:${key}`;

describe("mapRunActivity", () => {
  it("pairs tool events by call id and keeps args, preview, duration and errors", () => {
    const activity = mapRunActivity(
      record([
        ev("run.started", 0),
        ev("tool.started", 1, {
          tool: "acs_query",
          call_id: "c1",
          args: { sql: "select 1" },
        }),
        ev("tool.started", 1, {
          tool: "acs_describe",
          call_id: "c2",
          args: { table: "t" },
        }),
        ev("tool.failed", 2, {
          tool: "acs_describe",
          call_id: "c2",
          error: "no such table",
          ok: false,
        }),
        ev("tool.completed", 3, {
          tool: "acs_query",
          call_id: "c1",
          ok: true,
          duration_ms: 1850,
          preview: { rows: [{ n: 1 }] },
          preview_truncated: true,
        }),
        ev("usage.recorded", 4, {
          model: "m-large",
          input_tokens: 100,
          output_tokens: 20,
        }),
        ev("usage.recorded", 5, {
          model: "m-large",
          input_tokens: 50,
          output_tokens: 5,
        }),
        ev("run.completed", 42),
      ]),
      tr as never
    );

    expect(activity.stepCount).toBe(2);
    expect(activity.durationMs).toBe(42_000);
    expect(activity.usage).toEqual({
      inputTokens: 150,
      outputTokens: 25,
      models: ["m-large"],
    });
    const [query, describeStep] = activity.steps;
    expect(query).toMatchObject({
      id: "c1",
      tool: "acs_query",
      label: "t:harnessChat.stream.steps.query",
      args: { sql: "select 1" },
      preview: { rows: [{ n: 1 }] },
      previewTruncated: true,
      ms: 1850,
      ok: true,
      error: null,
    });
    expect(describeStep).toMatchObject({
      ok: false,
      error: "no such table",
      ms: 1000,
    });
  });

  it("pairs older records without call ids by tool, oldest first", () => {
    const activity = mapRunActivity(
      record([
        ev("tool.started", 0, { tool: "x_select" }),
        ev("tool.started", 1, { tool: "x_select" }),
        ev("tool.completed", 3, { tool: "x_select" }),
        ev("tool.completed", 4, { tool: "x_select" }),
      ]),
      tr as never
    );
    expect(activity.steps.map((s) => [s.args, s.ms, s.ok])).toEqual([
      [null, 3000, true],
      [null, 3000, true],
    ]);
  });

  it("nests a delegation's tool calls under it and records advisor consults", () => {
    const activity = mapRunActivity(
      record([
        ev("agent.started", 0, { agent: "agent_loop", turn: 1 }),
        ev("agent.started", 1, { agent: "advisor", turn: 1 }),
        ev("advisor.consulted", 3, {
          signal: "PLAN",
          note: "check the totals",
        }),
        ev("agent.started", 4, {
          agent: "workhorse",
          brief: "count late",
          delegate_id: "d1",
        }),
        ev("agent.started", 4, {
          agent: "workhorse",
          turn: 1,
          delegate_id: "d1",
        }),
        ev("tool.started", 5, {
          tool: "x_query",
          call_id: "k1",
          delegate_id: "d1",
        }),
        ev("tool.completed", 6, {
          tool: "x_query",
          call_id: "k1",
          delegate_id: "d1",
          ok: true,
        }),
        ev("delegate.completed", 7, {
          delegate_id: "d1",
          duration_ms: 3000,
          tools_run: ["x_query"],
          rows_returned: 4,
          turns: 2,
        }),
        ev("tool.failed", 8, {
          tool: "x_call",
          error: "bad arguments",
          args: { fn: "f" },
        }),
      ]),
      tr as never
    );

    const [advisor, delegate, refused] = activity.steps;
    expect(advisor).toMatchObject({
      tool: "ask_advisor",
      ok: true,
      ms: 2000,
      preview: { signal: "PLAN", note: "check the totals" },
    });
    expect(delegate).toMatchObject({
      id: "d1",
      tool: "delegate",
      args: { brief: "count late" },
      ok: true,
      ms: 3000,
      preview: { tools_run: ["x_query"], rows_returned: 4, turns: 2 },
    });
    expect(delegate.steps?.map((s) => s.id)).toEqual(["k1"]);
    expect(refused).toMatchObject({
      tool: "x_call",
      ok: false,
      error: "bad arguments",
      args: { fn: "f" },
    });
    expect(activity.stepCount).toBe(4);
  });
});
