import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  installSessionExpiryGuard,
  isAppApiUrl,
  type GuardedWindow,
  resetSessionExpiryGuard,
  signInUrl,
} from "./session-expiry";
import { tripsRequest, TripsApiError } from "@/features/trips/monitors/monitors-api";

const ORIGIN = "https://iot.example.com";
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

class FakeEventSource extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static last: FakeEventSource | null = null;
  readyState = 0;
  constructor(readonly url: string) {
    super();
    FakeEventSource.last = this;
  }
  fail() {
    this.readyState = FakeEventSource.CLOSED;
    this.dispatchEvent(new Event("error"));
  }
}

interface Setup {
  pathname?: string;
  search?: string;
  /** What the app's API answers. */
  api: () => Response;
  /** What `/api/auth/session` answers. */
  session?: unknown;
}

function setup({ pathname = `${BASE}/es/trips/42`, search = "", api, session = {} }: Setup) {
  const assign = vi.fn();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/auth/session")) return json(200, session);
    return api();
  });
  const win = {
    fetch: fetchMock,
    location: { origin: ORIGIN, pathname, search, hash: "", assign },
    EventSource: FakeEventSource,
  } as unknown as Required<GuardedWindow>;
  installSessionExpiryGuard(win);
  // The pages call the global fetch; point it at the guarded one.
  vi.stubGlobal("fetch", win.fetch);
  return { win, assign, fetchMock };
}

function settled(promise: Promise<unknown>) {
  return Promise.race([
    promise.then(
      () => "resolved",
      () => "rejected"
    ),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
  ]);
}

describe("session expiry guard", () => {
  beforeEach(() => resetSessionExpiryGuard());
  afterEach(() => vi.unstubAllGlobals());

  it("sends a 401 from the trips API to sign-in with the current page as callback", async () => {
    const { assign } = setup({
      search: "?tab=map",
      api: () => json(401, { error: "Unauthorized" }),
    });

    const result = await settled(tripsRequest("/board/planning"));

    expect(result).toBe("pending");
    expect(assign).toHaveBeenCalledTimes(1);
    expect(assign).toHaveBeenCalledWith(
      `${BASE}/es/sign-in?callbackUrl=${encodeURIComponent(`${BASE}/es/trips/42?tab=map`)}`
    );
  });

  it("keeps a 403 as the caller's error", async () => {
    const { assign } = setup({ api: () => json(403, { error: "Forbidden" }) });

    await expect(tripsRequest("/board/planning")).rejects.toEqual(
      new TripsApiError("Forbidden", 403)
    );
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps a 500 as the caller's error", async () => {
    const { assign } = setup({ api: () => json(500, { error: "Boom" }) });

    await expect(tripsRequest("/board/planning")).rejects.toThrow("Boom");
    expect(assign).not.toHaveBeenCalled();
  });

  it("keeps a 401 when the session is still there", async () => {
    const { assign } = setup({
      api: () => json(401, { error: "Unauthorized" }),
      session: { user: { email: "a@example.com" } },
    });

    await expect(tripsRequest("/board/planning")).rejects.toThrow("Unauthorized");
    expect(assign).not.toHaveBeenCalled();
  });

  it("redirects once when several requests get 401 at the same time", async () => {
    const { assign } = setup({ api: () => json(401, { error: "Unauthorized" }) });

    await Promise.all([
      settled(tripsRequest("/board/planning")),
      settled(tripsRequest("/board/counts")),
      settled(tripsRequest("/access")),
    ]);

    expect(assign).toHaveBeenCalledTimes(1);
  });

  it("does nothing on the sign-in page", async () => {
    const { assign } = setup({
      pathname: `${BASE}/es/sign-in`,
      api: () => json(401, { error: "Unauthorized" }),
    });

    await expect(tripsRequest("/access")).rejects.toThrow("Unauthorized");
    expect(assign).not.toHaveBeenCalled();
  });

  it("ignores a 401 from NextAuth's own routes", async () => {
    const { assign } = setup({ api: () => json(401, { error: "CredentialsSignin" }) });

    const response = await fetch(`${BASE}/api/auth/callback/credentials`);

    expect(response.status).toBe(401);
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a closed stream to sign-in when the session is gone", async () => {
    const { win, assign } = setup({ api: () => json(200, {}) });

    new win.EventSource(`${BASE}/api/trips/positions/stream`);
    (FakeEventSource.last as FakeEventSource).fail();
    await vi.waitFor(() => expect(assign).toHaveBeenCalledTimes(1));
  });

  it("keeps a closed stream when the session is still there", async () => {
    const { win, assign, fetchMock } = setup({
      api: () => json(200, {}),
      session: { user: { email: "a@example.com" } },
    });

    new win.EventSource(`${BASE}/api/trips/positions/stream`);
    (FakeEventSource.last as FakeEventSource).fail();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(assign).not.toHaveBeenCalled();
  });
});

describe("isAppApiUrl", () => {
  it("matches the app's API on the same origin only", () => {
    expect(isAppApiUrl(`${BASE}/api/trips/board/planning`, ORIGIN)).toBe(true);
    expect(isAppApiUrl(`${ORIGIN}${BASE}/api/trips`, ORIGIN)).toBe(true);
    expect(isAppApiUrl(`${BASE}/api/auth/session`, ORIGIN)).toBe(false);
    expect(isAppApiUrl(`https://other.example.com${BASE}/api/trips`, ORIGIN)).toBe(false);
    expect(isAppApiUrl(`${BASE}/es/trips`, ORIGIN)).toBe(false);
  });
});

describe("signInUrl", () => {
  it("uses the default sign-in page when the path has no language", () => {
    expect(signInUrl({ pathname: `${BASE}/start`, search: "", hash: "" })).toBe(
      `${BASE}/sign-in?callbackUrl=${encodeURIComponent(`${BASE}/start`)}`
    );
  });
});
