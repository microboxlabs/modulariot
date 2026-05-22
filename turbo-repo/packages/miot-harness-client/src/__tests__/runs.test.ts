import { describe, expect, it } from "vitest";
import { createMiotHarnessClient } from "../client.js";
import { MiotHarnessApiError } from "../errors.js";
import { createMockFetch, createMockSseFetch } from "./test-utils.js";

describe("runs.create", () => {
  it("POSTs to /runs:start (colon) and returns { run_id }", async () => {
    const { fn, call } = createMockFetch({ run_id: "run_abc" });
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    const result = await client.runs.create({
      message: "hello",
      tenant_id: "demo-tenant",
    });
    expect(result).toEqual({ run_id: "run_abc" });
    expect(call.url).toBe("http://harness.local/runs:start");
    expect(call.init.method).toBe("POST");
    expect(JSON.parse(call.init.body as string)).toEqual({
      message: "hello",
      tenant_id: "demo-tenant",
    });
  });
});

describe("runs.get", () => {
  it("GETs /runs/{id} URL-encoded and returns the record", async () => {
    const record = {
      run_id: "run id",
      status: "completed",
      events: [],
      artifacts: [],
      answer: "hi",
      conversation_id: null,
    };
    const { fn, call } = createMockFetch(record);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    const got = await client.runs.get("run id");
    expect(got).toEqual(record);
    expect(call.url).toBe("http://harness.local/runs/run%20id");
    expect(call.init.method).toBe("GET");
  });
});

describe("runs.stream", () => {
  it("consumes SSE frames and yields parsed events", async () => {
    const body =
      'id: e1\nevent: run.started\ndata: {"id":"e1","run_id":"run_abc","seq":1,"type":"run.started","message":"","data":{},"created_at":"2026-01-01T00:00:00Z"}\n\n' +
      'id: e2\nevent: run.completed\ndata: {"id":"e2","run_id":"run_abc","seq":2,"type":"run.completed","message":"","data":{},"created_at":"2026-01-01T00:00:00Z"}\n\n';
    const { fn, call } = createMockSseFetch(body);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });

    const events = [];
    for await (const e of client.runs.stream("run_abc")) events.push(e);

    expect(events.map((e) => e.type)).toEqual(["run.started", "run.completed"]);
    expect(call.url).toBe("http://harness.local/runs/run_abc/stream");
    expect(
      (call.init.headers as Record<string, string>).Accept,
    ).toBe("text/event-stream");
  });

  it("forwards Last-Event-ID when provided", async () => {
    const { fn, call } = createMockSseFetch("");
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    for await (const e of client.runs.stream("run_abc", { lastEventId: "evt_42" })) {
      void e;
    }
    const headers = call.init.headers as Record<string, string>;
    expect(headers["Last-Event-ID"]).toBe("evt_42");
  });

  it("throws MiotHarnessApiError when the harness emits event: error", async () => {
    const body =
      'event: error\ndata: {"error":"unknown_run_id","run_id":"run_zzz"}\n\n';
    const { fn } = createMockSseFetch(body);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    let caught: unknown;
    try {
      for await (const e of client.runs.stream("run_zzz")) {
        void e;
      }
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MiotHarnessApiError);
    expect((caught as MiotHarnessApiError).code).toBe("unknown_run_id");
    expect((caught as MiotHarnessApiError).runId).toBe("run_zzz");
  });

  it("throws MiotHarnessApiError on HTTP non-2xx for the stream endpoint", async () => {
    const fn = async (): Promise<Response> =>
      ({
        ok: false,
        status: 404,
        json: async () => ({ detail: "not found" }),
        text: async () => "not found",
      }) as unknown as Response;
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn,
    });
    let caught: unknown;
    try {
      for await (const e of client.runs.stream("run_missing")) {
        void e;
      }
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MiotHarnessApiError);
    expect((caught as MiotHarnessApiError).code).toBe("http_404");
    expect((caught as MiotHarnessApiError).runId).toBe("run_missing");
    expect((caught as MiotHarnessApiError).message).toBe("not found");
  });
});
