/**
 * Regression coverage for the map-positions BFF.
 *
 * The upstream gateway rate-limits this RPC by concurrency and rejects bursts
 * with `429 "Spike arrest: too many concurrent requests"`. The route must:
 *   - never surface that retryable backpressure as a hard 500,
 *   - collapse concurrent callers into a single upstream request, and
 *   - fall back to the last-known payload when the upstream is spiking.
 *
 * The route keeps module-level single-flight + cache state, so each test loads
 * a fresh copy via `vi.resetModules()` + dynamic import.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const authMock = vi.fn();

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

// Stub the M2M token client so the route does not hit the real login endpoint.
vi.mock("@/features/common/providers/sreamhub-api/streamhub-api.provider", () => ({
  AuthToken: class {
    async getToken(): Promise<string> {
      return "test-token";
    }
  },
}));

type ResponseInit = {
  ok: boolean;
  status: number;
  jsonData?: unknown;
  text?: string;
  headers?: Record<string, string>;
};

function makeResponse({
  ok,
  status,
  jsonData,
  text = "",
  headers = {},
}: ResponseInit) {
  const lower = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );
  return {
    ok,
    status,
    json: async () => jsonData,
    text: async () => text,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null },
  };
}

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const fetchMock = vi.fn();

describe("GET /api/map", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockReset();
    authMock.mockReset();
    authMock.mockResolvedValue({ user: { email: "u@example.com" } });
    process.env.STREAMHUB_URL = "https://gateway.example.com";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns 401 without surfacing upstream when unauthenticated", async () => {
    authMock.mockResolvedValue(null);
    const { GET } = await loadRoute();

    const response = await GET();

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the upstream positions on success", async () => {
    const positions = [{ id: "asset-1", location: "0101000000" }];
    fetchMock.mockResolvedValue(
      makeResponse({ ok: true, status: 200, jsonData: { data: positions } })
    );
    const { GET } = await loadRoute();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(positions);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT turn a 429 spike-arrest into a 500 (regression)", async () => {
    fetchMock.mockResolvedValue(
      makeResponse({
        ok: false,
        status: 429,
        text: "Spike arrest: too many concurrent requests, slow down.",
      })
    );
    const { GET } = await loadRoute();

    const response = await GET();

    // The bug: any non-OK upstream became a hard 500. A 429 is retryable
    // backpressure and must surface as a retryable status instead.
    expect(response.status).not.toBe(500);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
  });

  it("retries a 429 with backoff before giving up", async () => {
    fetchMock
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 429, text: "slow down" }))
      .mockResolvedValueOnce(makeResponse({ ok: false, status: 429, text: "slow down" }))
      .mockResolvedValueOnce(
        makeResponse({ ok: true, status: 200, jsonData: { data: [{ id: "a" }] } })
      );
    const { GET } = await loadRoute();

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([{ id: "a" }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("coalesces concurrent callers into a single upstream request", async () => {
    // A single pending upstream response both callers must share.
    let resolveFetch: (value: unknown) => void = () => {};
    const pending = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    fetchMock.mockReturnValue(pending);
    const { GET } = await loadRoute();

    const first = GET();
    const second = GET();
    // Wait until the single upstream call is actually in flight before settling.
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    resolveFetch(
      makeResponse({ ok: true, status: 200, jsonData: { data: [{ id: "x" }] } })
    );

    const [r1, r2] = await Promise.all([first, second]);

    expect(await r1.json()).toEqual([{ id: "x" }]);
    expect(await r2.json()).toEqual([{ id: "x" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to the last-known positions when the upstream starts spiking", async () => {
    const nowSpy = vi.spyOn(Date, "now");
    let clock = 1_000_000;
    nowSpy.mockImplementation(() => clock);

    const positions = [{ id: "asset-1" }];
    fetchMock.mockResolvedValueOnce(
      makeResponse({ ok: true, status: 200, jsonData: { data: positions } })
    );
    const { GET } = await loadRoute();

    // Warm the cache.
    const ok = await GET();
    expect(await ok.json()).toEqual(positions);

    // Advance past the TTL so the next call revalidates, but now the gateway
    // is rejecting with 429. The map keeps its last-known positions.
    clock += 60_000;
    fetchMock.mockResolvedValue(
      makeResponse({ ok: false, status: 429, text: "Spike arrest" })
    );

    const stale = await GET();

    expect(stale.status).toBe(200);
    expect(await stale.json()).toEqual(positions);
    expect(stale.headers.get("x-map-stale")).toBe("1");
  });
});
