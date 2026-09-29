import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { JWT } from "next-auth/jwt";
import type { Session } from "next-auth";

vi.mock("server-only", () => ({}));

const { authConfig } = await import("@/auth.config");

type JwtCallback = (params: { token: JWT }) => Promise<JWT>;
type SessionCallback = (params: { session: Session; token: JWT }) => Session;

const jwt = authConfig.callbacks!.jwt as unknown as JwtCallback;
const sessionCallback = authConfig.callbacks!
  .session as unknown as SessionCallback;

function makeIdToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.sig`;
}

const nowSeconds = () => Math.floor(Date.now() / 1000);
const fetchMock = vi.fn();

// Refresh results are shared per refresh token for the life of the module,
// so every test uses its own token.
let refreshTokenCounter = 0;
const nextRefreshToken = () => `refresh-token-${++refreshTokenCounter}`;

function mockRefreshSuccess(body: Record<string, unknown> = {}) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      id_token: makeIdToken({ exp: nowSeconds() + 36_000 }),
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 86_400,
      ...body,
    }),
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTH_AUTH0_ISSUER", "https://tenant.auth0.com");
  mockRefreshSuccess();
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("jwt callback refresh", () => {
  it("refreshes when the id_token is about to expire, even if the access token is valid", async () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() + 60 }),
      refreshToken: nextRefreshToken(),
      expiresAt: nowSeconds() + 60,
    } as JWT;

    const result = await jwt({ token });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.refreshToken).toBe("new-refresh-token");
    expect(result.expiresAt).toBeGreaterThan(nowSeconds() + 35_000);
    expect(result.expiresAt).toBeLessThan(nowSeconds() + 37_000);
  });

  it("does not refresh while both tokens are valid", async () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() + 3_600 }),
      refreshToken: nextRefreshToken(),
      expiresAt: nowSeconds() + 3_600,
    } as JWT;

    await jwt({ token });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("clears a previous refresh error after a successful refresh", async () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() + 60 }),
      refreshToken: nextRefreshToken(),
      expiresAt: nowSeconds() + 60,
      error: "RefreshTokenError",
    } as JWT;

    const result = await jwt({ token });

    expect(result.error).toBeUndefined();
  });

  it("marks the token when Auth0 rejects the refresh", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 403 });
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() + 60 }),
      refreshToken: nextRefreshToken(),
      expiresAt: nowSeconds() + 60,
    } as JWT;

    const result = await jwt({ token });

    expect(result.error).toBe("RefreshTokenError");
  });

  it("sends one Auth0 request for concurrent refreshes of the same token", async () => {
    const refreshToken = nextRefreshToken();
    const makeToken = () =>
      ({
        sub: "auth0|abc123",
        rawJWT: makeIdToken({ exp: nowSeconds() + 60 }),
        refreshToken,
        expiresAt: nowSeconds() + 60,
      }) as JWT;

    const results = await Promise.all([
      jwt({ token: makeToken() }),
      jwt({ token: makeToken() }),
      jwt({ token: makeToken() }),
    ]);

    expect(fetchMock).toHaveBeenCalledOnce();
    for (const result of results) {
      expect(result.refreshToken).toBe("new-refresh-token");
    }
  });

  it("keeps the current id_token when the refresh response has none", async () => {
    const currentIdToken = makeIdToken({ exp: nowSeconds() + 60 });
    mockRefreshSuccess({ id_token: undefined });
    const token = {
      sub: "auth0|abc123",
      rawJWT: currentIdToken,
      refreshToken: nextRefreshToken(),
      expiresAt: nowSeconds() + 60,
    } as JWT;

    const result = await jwt({ token });

    expect(result.rawJWT).toBe(currentIdToken);
    expect(result.expiresAt).toBe(nowSeconds() + 60);
  });
});

describe("jwt callback with a session saved before expiresAt existed", () => {
  it("refreshes when its id_token has expired", async () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() - 3_600 }),
      refreshToken: nextRefreshToken(),
      accessTokenExpiresAt: nowSeconds() + 40_000,
    } as JWT;

    const result = await jwt({ token });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.expiresAt).toBeGreaterThan(nowSeconds());
  });

  it("does not refresh while its id_token is valid", async () => {
    const idTokenExp = nowSeconds() + 3_600;
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: idTokenExp }),
      refreshToken: nextRefreshToken(),
      accessTokenExpiresAt: nowSeconds() + 40_000,
    } as JWT;

    const result = await jwt({ token });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.expiresAt).toBe(idTokenExp);
  });
});

describe("session callback", () => {
  const baseSession = () =>
    ({
      user: { email: "jane@example.com" },
      expires: new Date(Date.now() + 86_400_000).toISOString(),
    }) as Session;

  it("returns no user once the forwarded token has expired", () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: "expired-id-token",
      expiresAt: nowSeconds() - 1,
    } as JWT;

    expect(sessionCallback({ session: baseSession(), token }).user).toBe(
      undefined
    );
  });

  it("returns no user when the session has no id_token", () => {
    const token = {
      sub: "auth0|abc123",
      expiresAt: nowSeconds() + 3_600,
    } as JWT;

    expect(sessionCallback({ session: baseSession(), token }).user).toBe(
      undefined
    );
  });

  it("exposes the id_token while it is valid", () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: "valid-id-token",
      expiresAt: nowSeconds() + 3_600,
    } as JWT;

    const session = sessionCallback({ session: baseSession(), token });

    expect(session.user?.id).toBe("auth0|abc123");
    expect(session.user?.rawJWT).toBe("valid-id-token");
  });
});
