import { describe, it, expect } from "vitest";
import { jwtExpiresAt, sessionExpiresAt } from "./token-expiry";

function makeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  return `${encode({ alg: "RS256", typ: "JWT" })}.${encode(payload)}.fake-signature`;
}

describe("jwtExpiresAt", () => {
  it("reads the exp claim", () => {
    expect(jwtExpiresAt(makeJwt({ exp: 1_758_569_869 }))).toBe(1_758_569_869);
  });

  it("decodes base64url payloads with - and _", () => {
    // "name" chosen so the encoded payload contains base64url-only characters
    const jwt = makeJwt({ exp: 1_000, name: "ÿÿ>>??" });
    expect(jwt.split(".")[1]).toMatch(/[-_]/);
    expect(jwtExpiresAt(jwt)).toBe(1_000);
  });

  it("returns undefined for missing, malformed or exp-less tokens", () => {
    expect(jwtExpiresAt(undefined)).toBeUndefined();
    expect(jwtExpiresAt("not-a-jwt")).toBeUndefined();
    expect(jwtExpiresAt("a.!!!.c")).toBeUndefined();
    expect(jwtExpiresAt(makeJwt({ sub: "x" }))).toBeUndefined();
  });
});

describe("sessionExpiresAt", () => {
  it("uses the id_token expiry when it comes before the access token", () => {
    expect(sessionExpiresAt(2_000, makeJwt({ exp: 1_000 }))).toBe(1_000);
  });

  it("uses the access token expiry when it comes first", () => {
    expect(sessionExpiresAt(1_000, makeJwt({ exp: 2_000 }))).toBe(1_000);
  });

  it("falls back to whichever value is present", () => {
    expect(sessionExpiresAt(undefined, makeJwt({ exp: 1_000 }))).toBe(1_000);
    expect(sessionExpiresAt(1_000, undefined)).toBe(1_000);
  });

  it("returns 0 when neither is known", () => {
    expect(sessionExpiresAt(undefined, undefined)).toBe(0);
  });
});
