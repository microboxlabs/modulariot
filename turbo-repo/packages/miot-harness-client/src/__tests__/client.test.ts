import { describe, expect, it } from "vitest";
import { createMiotHarnessClient } from "../client.js";
import { MiotHarnessApiError } from "../errors.js";
import { createMockFetch } from "./test-utils.js";

describe("createMiotHarnessClient — request building", () => {
  it("trims trailing slashes on baseUrl and POSTs to /runs:start", async () => {
    const { fn, call } = createMockFetch({ run_id: "run_abc" });
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local///",
      fetch: fn as unknown as typeof globalThis.fetch,
    });
    await client.runs.create({ message: "hi" });
    expect(call.url).toBe("http://harness.local/runs:start");
    expect(call.init.method).toBe("POST");
  });

  it("adds Authorization: Bearer when token is set", async () => {
    const { fn, call } = createMockFetch({ run_id: "x" });
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      token: "tok-123",
      fetch: fn as unknown as typeof globalThis.fetch,
    });
    await client.runs.create({ message: "x" });
    const headers = call.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer tok-123");
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("merges per-request headers over config headers", async () => {
    const { fn, call } = createMockFetch({} as unknown);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      headers: { "X-Trace": "global" },
      fetch: fn as unknown as typeof globalThis.fetch,
    });
    await client.runs.get("run_abc");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["X-Trace"]).toBe("global");
    expect(headers.Accept).toBe("application/json");
  });

  it("propagates AbortSignal to fetch", async () => {
    const { fn, call } = createMockFetch({ run_id: "x" });
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn as unknown as typeof globalThis.fetch,
    });
    const ctrl = new AbortController();
    await client.runs.create({ message: "x" }, { signal: ctrl.signal });
    expect(call.init.signal).toBe(ctrl.signal);
  });
});

describe("createMiotHarnessClient — error handling", () => {
  it("throws MiotHarnessApiError on non-2xx with structured body", async () => {
    const { fn } = createMockFetch({ detail: "boom" }, 500);
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn as unknown as typeof globalThis.fetch,
    });
    let caught: unknown;
    try {
      await client.runs.create({ message: "x" });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MiotHarnessApiError);
    const err = caught as MiotHarnessApiError;
    expect(err.code).toBe("http_500");
    expect(err.status).toBe(500);
    expect(err.message).toBe("boom");
  });

  it("falls back to text body when JSON parse fails", async () => {
    const fn = async (): Promise<Response> =>
      ({
        ok: false,
        status: 502,
        json: async () => {
          throw new SyntaxError("not json");
        },
        text: async () => "gateway",
      }) as unknown as Response;
    const client = createMiotHarnessClient({
      baseUrl: "http://harness.local",
      fetch: fn as unknown as typeof globalThis.fetch,
    });
    let caught: unknown;
    try {
      await client.runs.get("run_zzz");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(MiotHarnessApiError);
    expect((caught as MiotHarnessApiError).message).toBe("gateway");
    expect((caught as MiotHarnessApiError).status).toBe(502);
  });
});
