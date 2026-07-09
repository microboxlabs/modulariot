import { describe, it, expect, vi } from "vitest";
import { episodesUrlFromHarnessBase, makeEpisodeRecorder } from "./episodes.js";

describe("episodesUrlFromHarnessBase", () => {
  it("maps the org-scoped harness path to the interactions endpoint", () => {
    expect(
      episodesUrlFromHarnessBase("https://m.test/api/v1/orgs/mintral/harness"),
    ).toBe("https://m.test/api/v1/orgs/mintral/interactions/episodes");
  });

  it("tolerates a trailing slash", () => {
    expect(
      episodesUrlFromHarnessBase("https://m.test/api/v1/orgs/mintral/harness/"),
    ).toBe("https://m.test/api/v1/orgs/mintral/interactions/episodes");
  });

  it("returns null for a non-harness base (capture disabled)", () => {
    expect(episodesUrlFromHarnessBase("https://m.test/api/v1")).toBeNull();
  });
});

describe("makeEpisodeRecorder", () => {
  it("POSTs the episode to the interactions endpoint with the bearer token", () => {
    const fetchImpl = vi.fn((_u: string, _i: RequestInit) =>
      Promise.resolve(new Response(null, { status: 201 })),
    );
    const record = makeEpisodeRecorder({
      harnessBaseUrl: "https://m.test/api/v1/orgs/mintral/harness",
      token: "jwt-1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    record({ surface: "cli", signal: "remember", payload: { fact: "x" } });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe("https://m.test/api/v1/orgs/mintral/interactions/episodes");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-1");
    expect(JSON.parse(init.body as string)).toEqual({
      surface: "cli",
      signal: "remember",
      payload: { fact: "x" },
    });
  });

  it("is a no-op for a non-harness base", () => {
    const fetchImpl = vi.fn((_u: string, _i: RequestInit) =>
      Promise.resolve(new Response()),
    );
    const record = makeEpisodeRecorder({
      harnessBaseUrl: "https://m.test/api/v1",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    record({ surface: "cli" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("never throws when the write fails (best-effort)", async () => {
    const fetchImpl = vi.fn((_u: string, _i: RequestInit) =>
      Promise.reject(new Error("net")),
    );
    const record = makeEpisodeRecorder({
      harnessBaseUrl: "https://m.test/api/v1/orgs/o/harness",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(() => record({ surface: "cli" })).not.toThrow();
    await Promise.resolve();
  });
});
