import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const forwardMock = vi.fn();
const sessionMock = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/auth", () => ({ auth: () => sessionMock() }));
vi.mock("@/app/api/utils/tenant-scope", () => ({
  resolveTenantScope: async () => ({
    resolved: true,
    scope: { activeOrg: { slug: "acme" } },
  }),
}));
vi.mock("@/app/api/utils/streamhub-modulith-proxy", () => ({
  forwardToStreamhubModulith: (...args: unknown[]) => forwardMock(...args),
}));
vi.mock(
  "@/features/common/providers/sreamhub-api/streamhub-api.provider",
  () => ({
    AuthToken: class {
      getToken = async () => "m2m";
    },
  })
);

import { GET } from "./route";

const positions = [
  {
    assetid: "AB12",
    timestamp: "2026-10-22T10:00:00+00:00",
    speed: 50,
    heading: 1.5,
    location: "0101000020E610000000000000000051C00000000000A040C0",
    longitude: -68,
    latitude: -33.25,
  },
  {
    assetid: "AB12",
    timestamp: "2026-10-22T10:01:00+00:00",
    speed: 0,
    heading: 0,
    location: "0101000020E610000000000000000051C00000000000A040C0",
    longitude: -68,
    latitude: -33.259,
    tripid: "T1",
  },
];

function request(query: Record<string, string>) {
  return new NextRequest(`http://x/h?${new URLSearchParams(query).toString()}`);
}

const range = {
  assetId: "AB 12",
  p_from: "2026-10-22T00:00:00-03:00",
  p_to: "2026-10-23T23:59:59-03:00",
};

describe("GET /api/map/historic-pulses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionMock.mockResolvedValue({ user: { id: "u1" } });
    forwardMock.mockImplementation(async () => NextResponse.json(positions));
    vi.stubEnv("STREAMHUB_IOT_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("sends the modulith's positions for the range as server-sent events, with the metres between them", async () => {
    const res = await GET(request(range));

    expect(forwardMock).toHaveBeenCalledWith(
      "/api/v1/orgs/acme/control-tower/map/assets/AB%2012/positions?from=2026-10-22T00%3A00%3A00-03%3A00&to=2026-10-23T23%3A59%3A59-03%3A00",
      { method: "GET", sessionOnly: true }
    );
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    const events = (await res.text())
      .split("\n\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line.replace(/^data: /, "")));
    expect(events).toEqual([
      { ...positions[0], distance: 0 },
      { ...positions[1], distance: 1001 },
    ]);
  });

  it("sends an empty stream when the asset has no signals", async () => {
    forwardMock.mockImplementation(async () => NextResponse.json([]));

    const res = await GET(request(range));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("sends no events for a body that is not an array", async () => {
    forwardMock.mockImplementation(
      async () => new Response(null, { status: 204 })
    );

    expect(await (await GET(request(range))).text()).toBe("");
  });

  it("closes the AVL stream on a date it cannot read", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "http://avl.test");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request({ ...range, p_from: "not a date" }));

    expect(await res.text()).toMatch(/^event: failed\ndata: /);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers 502 when the modulith's body is not JSON", async () => {
    forwardMock.mockImplementation(
      async () => new Response("<html></html>", { status: 200 })
    );

    expect((await GET(request(range))).status).toBe(502);
  });

  it("passes a modulith 400 through", async () => {
    forwardMock.mockImplementation(async () =>
      NextResponse.json({ error: "from must be before to" }, { status: 400 })
    );

    const res = await GET(request(range));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "from must be before to" });
  });

  it("refuses a request without the asset or the range", async () => {
    expect((await GET(request({ ...range, assetId: "" }))).status).toBe(400);
    expect((await GET(request({ ...range, p_to: "" }))).status).toBe(400);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("keeps reading the AVL API when it is configured", async () => {
    vi.stubEnv("STREAMHUB_IOT_URL", "http://avl.test");
    const fetchMock = vi.fn(async () => new Response("down", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await GET(request(range));

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(await res.text()).toMatch(/^event: failed\ndata: /);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(forwardMock).not.toHaveBeenCalled();
  });

  it("refuses a request without a session", async () => {
    sessionMock.mockResolvedValue(null);

    expect((await GET(request(range))).status).toBe(401);
    expect(forwardMock).not.toHaveBeenCalled();
  });
});
