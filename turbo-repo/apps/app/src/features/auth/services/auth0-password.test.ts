import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CredentialsSignin } from "next-auth";
import { authenticateWithAuth0Password } from "./auth0-password";

function makeIdToken(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.fake-signature`;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("AUTH_AUTH0_ID", "client-id");
  vi.stubEnv("AUTH_AUTH0_SECRET", "client-secret");
  vi.stubEnv("AUTH_AUTH0_ISSUER", "https://tenant.auth0.com");
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function mockTokenResponse(idTokenPayload: Record<string, unknown>) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({
      id_token: makeIdToken(idTokenPayload),
      access_token: "access-token",
      refresh_token: "refresh-token",
      expires_in: 3600,
      token_type: "Bearer",
    }),
  });
}

describe("authenticateWithAuth0Password", () => {
  it("returns a JWT-carrying user on valid credentials", async () => {
    mockTokenResponse({
      sub: "auth0|abc123",
      name: "Jane Doe",
      email: "jane@example.com",
      picture: "https://cdn.example.com/jane.png",
    });

    const before = Math.floor(Date.now() / 1000);
    const user = await authenticateWithAuth0Password({
      email: "jane@example.com",
      password: "s3cret-pass",
    });

    expect(user.id).toBe("auth0|abc123");
    expect(user.name).toBe("Jane Doe");
    expect(user.email).toBe("jane@example.com");
    expect(user.idToken).toContain(".");
    expect(user.refreshToken).toBe("refresh-token");
    expect(user.expiresAt).toBeGreaterThanOrEqual(before + 3600);
    expect(user.ticket).toBeUndefined();
  });

  it("posts the password-realm grant to the issuer token endpoint", async () => {
    mockTokenResponse({ sub: "auth0|abc123", email: "jane@example.com" });

    await authenticateWithAuth0Password({
      email: "jane@example.com",
      password: "s3cret-pass",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://tenant.auth0.com/oauth/token");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      grant_type: "http://auth0.com/oauth/grant-type/password-realm",
      realm: "Username-Password-Authentication",
      username: "jane@example.com",
      password: "s3cret-pass",
      client_id: "client-id",
      client_secret: "client-secret",
      scope: "openid profile email offline_access",
    });
    expect(body.audience).toBeUndefined();
  });

  it("uses the configured credentials connection as realm", async () => {
    vi.stubEnv("AUTH_AUTH0_CONNECTION_CREDENTIALS", "my-users-db");
    mockTokenResponse({ sub: "auth0|abc123", email: "jane@example.com" });

    await authenticateWithAuth0Password({
      email: "jane@example.com",
      password: "s3cret-pass",
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.realm).toBe("my-users-db");
  });

  it("includes the audience only when AUTH_AUTH0_AUDIENCE is set", async () => {
    vi.stubEnv("AUTH_AUTH0_AUDIENCE", "https://api.example.com");
    mockTokenResponse({ sub: "auth0|abc123", email: "jane@example.com" });

    await authenticateWithAuth0Password({
      email: "jane@example.com",
      password: "s3cret-pass",
    });

    const body = JSON.parse(
      (fetchMock.mock.calls[0][1] as RequestInit).body as string
    );
    expect(body.audience).toBe("https://api.example.com");
  });

  it("falls back to the email when the id_token has no name", async () => {
    mockTokenResponse({ sub: "auth0|abc123", email: "jane@example.com" });

    const user = await authenticateWithAuth0Password({
      email: "jane@example.com",
      password: "s3cret-pass",
    });

    expect(user.name).toBe("jane@example.com");
  });

  it("throws CredentialsSignin on invalid credentials without leaking details", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({
        error: "invalid_grant",
        error_description: "Wrong email or password.",
      }),
    });

    await expect(
      authenticateWithAuth0Password({
        email: "jane@example.com",
        password: "wrong",
      })
    ).rejects.toBeInstanceOf(CredentialsSignin);
  });

  it("throws CredentialsSignin when the token endpoint is unreachable", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      authenticateWithAuth0Password({
        email: "jane@example.com",
        password: "s3cret-pass",
      })
    ).rejects.toBeInstanceOf(CredentialsSignin);
  });
});

describe("tokenFieldsForCredentialsUser", () => {
  it("maps an Auth0-credentials user to a JWT-shaped token (no ticket)", async () => {
    const { tokenFieldsForCredentialsUser } = await import("./auth0-password");
    const fields = tokenFieldsForCredentialsUser({
      id: "auth0|abc123",
      name: "Jane Doe",
      email: "jane@example.com",
      groups: [],
      idToken: "header.payload.sig",
      refreshToken: "refresh-token",
      expiresAt: 1750000000,
    });
    expect(fields).toEqual({
      rawJWT: "header.payload.sig",
      accessTokenExpiresAt: 1750000000,
      refreshToken: "refresh-token",
      ticket: undefined,
    });
  });

  it("maps a legacy Alfresco user to a ticket-shaped token (no JWT)", async () => {
    const { tokenFieldsForCredentialsUser } = await import("./auth0-password");
    const fields = tokenFieldsForCredentialsUser({
      id: "jane",
      name: "Jane Doe",
      email: "jane@example.com",
      groups: [],
      ticket: "TICKET_abc",
    });
    expect(fields).toEqual({
      ticket: "TICKET_abc",
      rawJWT: undefined,
    });
  });
});
