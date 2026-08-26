import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recordEpisode } from "./record-episode";

describe("recordEpisode", () => {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) =>
    Promise.resolve(new Response(null, { status: 201 })),
  );

  beforeEach(() => {
    vi.stubEnv("MIOT_MODULITH_URL", "http://modulith:8180");
    vi.stubGlobal("fetch", fetchMock);
    fetchMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("POSTs the episode to the org-scoped modulith endpoint with the bearer token", async () => {
    await recordEpisode({
      orgSlug: "mintral",
      token: "jwt-123",
      body: { surface: "spotlight", runId: "r1", payload: { query: "entregas" } },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://modulith:8180/api/v1/orgs/mintral/interactions/episodes");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer jwt-123");
    expect(JSON.parse(init.body as string)).toEqual({
      surface: "spotlight",
      runId: "r1",
      payload: { query: "entregas" },
    });
  });

  it("is a no-op when the harness host is unset", async () => {
    vi.stubEnv("MIOT_MODULITH_URL", "");
    await recordEpisode({ orgSlug: "o", token: "t", body: { surface: "cli" } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never throws when the write fails (best-effort learning signal)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network"));
    await expect(
      recordEpisode({ orgSlug: "o", token: "t", body: { surface: "spotlight" } }),
    ).resolves.toBeUndefined();
  });
});
