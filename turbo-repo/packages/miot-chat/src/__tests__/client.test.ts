import { afterEach, describe, expect, it, vi } from "vitest";
import { createHarnessClient } from "../harness/client.js";
import { HarnessRunError } from "../harness/types.js";

type FetchImpl = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

function sseResponse(body: string): Response {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(body));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fetchMock(impl: FetchImpl) {
  return vi.fn<FetchImpl>(impl);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createHarnessClient.createRun", () => {
  it("POSTs to /runs:start (colon, not slash) with bearer token", async () => {
    const fetcher = fetchMock(async () => jsonResponse({ run_id: "run_abc" }, 202));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      token: "tok-123",
      fetch: fetcher,
    });

    const result = await client.createRun({
      message: "hello",
      tenant_id: "demo-tenant",
    });

    expect(result).toEqual({ run_id: "run_abc" });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://harness.local/runs:start");
    expect(init?.method).toBe("POST");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Authorization).toBe("Bearer tok-123");
    expect(headers?.["Content-Type"]).toBe("application/json");
    expect(JSON.parse((init?.body as string) ?? "{}")).toEqual({
      message: "hello",
      tenant_id: "demo-tenant",
    });
  });

  it("trims trailing slashes on baseUrl", async () => {
    const fetcher = fetchMock(async () => jsonResponse({ run_id: "run_abc" }));
    const client = createHarnessClient({
      baseUrl: "http://harness.local///",
      fetch: fetcher,
    });
    await client.createRun({ message: "x" });
    const [url] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://harness.local/runs:start");
  });

  it("propagates AbortSignal", async () => {
    const fetcher = fetchMock(async () => jsonResponse({ run_id: "run_abc" }));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });
    const ctrl = new AbortController();
    await client.createRun({ message: "x" }, { signal: ctrl.signal });
    const [, init] = fetcher.mock.calls[0] ?? [];
    expect(init?.signal).toBe(ctrl.signal);
  });

  it("throws HarnessRunError on non-2xx", async () => {
    const fetcher = fetchMock(
      async () => new Response("boom", { status: 500, statusText: "Server Error" }),
    );
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });
    await expect(client.createRun({ message: "x" })).rejects.toBeInstanceOf(
      HarnessRunError,
    );
  });
});

describe("createHarnessClient.streamRun", () => {
  it("GETs /runs/{id}/stream, parses SSE, yields events", async () => {
    const body =
      'id: e1\nevent: run.started\ndata: {"id":"e1","run_id":"run_abc","seq":1,"type":"run.started","message":"","data":{},"created_at":"2026-01-01T00:00:00Z"}\n\n' +
      'id: e2\nevent: run.completed\ndata: {"id":"e2","run_id":"run_abc","seq":2,"type":"run.completed","message":"","data":{},"created_at":"2026-01-01T00:00:00Z"}\n\n';
    const fetcher = fetchMock(async () => sseResponse(body));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });

    const events = [];
    for await (const e of client.streamRun("run_abc")) events.push(e);

    expect(events.map((e) => e.type)).toEqual(["run.started", "run.completed"]);
    const [url, init] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://harness.local/runs/run_abc/stream");
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.Accept).toBe("text/event-stream");
  });

  it("forwards Last-Event-ID when provided", async () => {
    const fetcher = fetchMock(async () => sseResponse(""));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });
    const drained: unknown[] = [];
    for await (const e of client.streamRun("run_abc", { lastEventId: "evt_42" })) {
      drained.push(e);
    }
    expect(drained).toEqual([]);
    const [, init] = fetcher.mock.calls[0] ?? [];
    const headers = init?.headers as Record<string, string> | undefined;
    expect(headers?.["Last-Event-ID"]).toBe("evt_42");
  });

  it("throws HarnessRunError when the harness emits event: error", async () => {
    const body =
      'event: error\ndata: {"error":"unknown_run_id","run_id":"run_zzz"}\n\n';
    const fetcher = fetchMock(async () => sseResponse(body));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });
    let caught: unknown;
    try {
      for await (const e of client.streamRun("run_zzz")) {
        void e;
      }
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(HarnessRunError);
    expect((caught as HarnessRunError).code).toBe("unknown_run_id");
    expect((caught as HarnessRunError).runId).toBe("run_zzz");
  });

  it("URL-encodes run_id with awkward characters", async () => {
    const fetcher = fetchMock(async () => sseResponse(""));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });
    for await (const e of client.streamRun("run id/with spaces")) {
      void e;
    }
    const [url] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://harness.local/runs/run%20id%2Fwith%20spaces/stream");
  });
});

describe("createHarnessClient.getRun", () => {
  it("GETs /runs/{id} and returns the parsed record", async () => {
    const record = {
      run_id: "run_abc",
      status: "completed",
      events: [],
      artifacts: [],
      answer: "hi",
      conversation_id: null,
    };
    const fetcher = fetchMock(async () => jsonResponse(record));
    const client = createHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fetcher,
    });
    const got = await client.getRun("run_abc");
    expect(got).toEqual(record);
    const [url] = fetcher.mock.calls[0] ?? [];
    expect(url).toBe("http://harness.local/runs/run_abc");
  });
});
