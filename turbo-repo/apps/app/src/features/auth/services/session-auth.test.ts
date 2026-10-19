import { describe, it, expect } from "vitest";
import type { Session } from "next-auth";
import { sessionAuthHeader, sessionToken } from "./session-auth";

const sessionWith = (rawJWT?: string) =>
  ({
    user: { id: "auth0|abc123", email: "jane@example.com", rawJWT },
    expires: "2099-01-01T00:00:00.000Z",
  }) as Session;

describe("sessionToken", () => {
  it("returns the session's id_token", () => {
    expect(sessionToken(sessionWith("id-token"))).toBe("id-token");
  });

  it("returns undefined without a session", () => {
    expect(sessionToken(null)).toBeUndefined();
  });
});

describe("sessionAuthHeader", () => {
  it("builds a Bearer header from the session token", () => {
    expect(sessionAuthHeader(sessionWith("id-token"))).toEqual({
      Authorization: "Bearer id-token",
    });
  });

  it("is empty when the session has no token", () => {
    expect(sessionAuthHeader(sessionWith())).toEqual({});
    expect(sessionAuthHeader(undefined)).toEqual({});
  });
});
