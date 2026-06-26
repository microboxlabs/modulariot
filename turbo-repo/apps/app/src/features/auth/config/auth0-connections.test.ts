import { describe, it, expect, afterEach, vi } from "vitest";
import {
  getAuth0Connection,
  getCredentialsConnection,
  isAuth0Configured,
} from "./auth0-connections";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAuth0Connection", () => {
  it("maps google to the default Auth0 connection", () => {
    expect(getAuth0Connection("google")).toBe("google-oauth2");
  });

  it("maps github to the default Auth0 connection", () => {
    expect(getAuth0Connection("github")).toBe("github");
  });

  it("maps both microsoft provider ids to the default Entra connection", () => {
    expect(getAuth0Connection("microsoft-entra-id")).toBe("Mintral-Entra-ID");
    expect(getAuth0Connection("microsoft")).toBe("Mintral-Entra-ID");
  });

  it("returns undefined for providers not brokered through Auth0", () => {
    expect(getAuth0Connection("saml")).toBeUndefined();
    expect(getAuth0Connection("unknown")).toBeUndefined();
  });

  it("honors AUTH_AUTH0_CONNECTION_GOOGLE override", () => {
    vi.stubEnv("AUTH_AUTH0_CONNECTION_GOOGLE", "my-google-conn");
    expect(getAuth0Connection("google")).toBe("my-google-conn");
  });

  it("honors AUTH_AUTH0_CONNECTION_GITHUB override", () => {
    vi.stubEnv("AUTH_AUTH0_CONNECTION_GITHUB", "my-github-conn");
    expect(getAuth0Connection("github")).toBe("my-github-conn");
  });

  it("honors AUTH_AUTH0_CONNECTION_ENTRA_ID override for both microsoft ids", () => {
    vi.stubEnv("AUTH_AUTH0_CONNECTION_ENTRA_ID", "Acme-Entra-ID");
    expect(getAuth0Connection("microsoft-entra-id")).toBe("Acme-Entra-ID");
    expect(getAuth0Connection("microsoft")).toBe("Acme-Entra-ID");
  });
});

describe("getCredentialsConnection", () => {
  it("defaults to the Auth0 default database connection", () => {
    expect(getCredentialsConnection()).toBe("Username-Password-Authentication");
  });

  it("honors AUTH_AUTH0_CONNECTION_CREDENTIALS override", () => {
    vi.stubEnv("AUTH_AUTH0_CONNECTION_CREDENTIALS", "my-users-db");
    expect(getCredentialsConnection()).toBe("my-users-db");
  });
});

describe("isAuth0Configured", () => {
  it("is false when the Auth0 client env vars are missing", () => {
    vi.stubEnv("AUTH_AUTH0_ID", "");
    vi.stubEnv("AUTH_AUTH0_SECRET", "");
    vi.stubEnv("AUTH_AUTH0_ISSUER", "");
    expect(isAuth0Configured()).toBe(false);
  });

  it("is false when only some Auth0 client env vars are set", () => {
    vi.stubEnv("AUTH_AUTH0_ID", "client-id");
    vi.stubEnv("AUTH_AUTH0_SECRET", "");
    vi.stubEnv("AUTH_AUTH0_ISSUER", "https://tenant.auth0.com");
    expect(isAuth0Configured()).toBe(false);
  });

  it("is false when an Auth0 client env var is whitespace-only", () => {
    vi.stubEnv("AUTH_AUTH0_ID", "   ");
    vi.stubEnv("AUTH_AUTH0_SECRET", "client-secret");
    vi.stubEnv("AUTH_AUTH0_ISSUER", "https://tenant.auth0.com");
    expect(isAuth0Configured()).toBe(false);
  });

  it("is true when id, secret and issuer are all set", () => {
    vi.stubEnv("AUTH_AUTH0_ID", "client-id");
    vi.stubEnv("AUTH_AUTH0_SECRET", "client-secret");
    vi.stubEnv("AUTH_AUTH0_ISSUER", "https://tenant.auth0.com");
    expect(isAuth0Configured()).toBe(true);
  });
});
