import { describe, expect, it } from "vitest";
import {
  buildAuthorizationUrl,
  buildPlatformLoginUrl,
} from "../browser-oauth.js";

describe("buildPlatformLoginUrl", () => {
  it("builds a platform session handoff URL", () => {
    const url = new URL(
      buildPlatformLoginUrl({
        loginUrl: "https://app.example.com/cli/auth/login?prompt=login",
        redirectUri: "http://127.0.0.1:4321/callback",
        state: "state-123",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://app.example.com/cli/auth/login",
    );
    expect(url.searchParams.get("prompt")).toBe("login");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:4321/callback",
    );
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.has("organization_id")).toBe(false);
  });
});

describe("buildAuthorizationUrl", () => {
  it("builds an OAuth authorization URL with PKCE parameters", () => {
    const url = new URL(
      buildAuthorizationUrl({
        authorizationUrl: "https://auth.example.com/oauth/authorize?prompt=login",
        clientId: "miot-cli",
        redirectUri: "http://127.0.0.1:4321/callback",
        scope: "openid profile email",
        state: "state-123",
        codeChallenge: "challenge-123",
        audience: "https://api.example.com",
      }),
    );

    expect(url.origin + url.pathname).toBe(
      "https://auth.example.com/oauth/authorize",
    );
    expect(url.searchParams.get("prompt")).toBe("login");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe("miot-cli");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "http://127.0.0.1:4321/callback",
    );
    expect(url.searchParams.get("scope")).toBe("openid profile email");
    expect(url.searchParams.get("state")).toBe("state-123");
    expect(url.searchParams.get("code_challenge")).toBe("challenge-123");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("audience")).toBe("https://api.example.com");
  });
});
