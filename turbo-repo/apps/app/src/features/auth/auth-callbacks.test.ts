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

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTH_AUTH0_ISSUER", "https://tenant.auth0.com");
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      id_token: makeIdToken({ exp: nowSeconds() + 36_000 }),
      access_token: "new-access-token",
      refresh_token: "new-refresh-token",
      expires_in: 86_400,
    }),
  });
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
      refreshToken: "old-refresh-token",
      expiresAt: nowSeconds() + 60,
    } as JWT;

    const result = await jwt({ token });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.refreshToken).toBe("new-refresh-token");
    expect(result.expiresAt).toBeGreaterThan(nowSeconds() + 35_000);
    expect(result.expiresAt).toBeLessThan(nowSeconds() + 37_000);
  });

  it("refreshes a session written before expiresAt existed", async () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() - 3_600 }),
      refreshToken: "old-refresh-token",
      accessTokenExpiresAt: nowSeconds() + 40_000,
    } as JWT & { accessTokenExpiresAt: number };

    const result = await jwt({ token });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(result.expiresAt).toBeGreaterThan(nowSeconds());
  });

  it("does not refresh while both tokens are valid", async () => {
    const token = {
      sub: "auth0|abc123",
      rawJWT: makeIdToken({ exp: nowSeconds() + 3_600 }),
      refreshToken: "old-refresh-token",
      expiresAt: nowSeconds() + 3_600,
    } as JWT;

    await jwt({ token });

    expect(fetchMock).not.toHaveBeenCalled();
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
