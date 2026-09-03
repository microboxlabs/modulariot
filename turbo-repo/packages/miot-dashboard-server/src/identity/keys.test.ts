/**
 * jose does the caching, refreshing and parsing behind a JWKS endpoint, and
 * that is not restated here. These tests cover the two rules this module adds:
 * the URL may not be plaintext, and an RSA key must be at least 2048 bits.
 */

import { beforeAll, describe, expect, it } from "vitest";
import {
  generateTestKeyPair,
  weakPublicKeyPem,
  type TestKeyPair,
} from "../test/tokens";
import {
  createJwksKeyRing,
  hmacKeyFromSecret,
  KeySourceError,
  publicKeyFromPem,
} from "./keys";

let pair: TestKeyPair;

beforeAll(async () => {
  pair = await generateTestKeyPair("key-1");
});

const URL_UNDER_TEST = "https://issuer.test/.well-known/jwks.json";

describe("createJwksKeyRing", () => {
  it("refuses to fetch its trust root over plaintext http", async () => {
    // The document at this URL determines which signatures are trusted.
    await expect(
      createJwksKeyRing({ url: "http://issuer.test/.well-known/jwks.json" }),
    ).rejects.toThrow(KeySourceError);
  });

  it("allows http on loopback, so a fake provider can be run locally", async () => {
    await expect(
      createJwksKeyRing({ url: "http://127.0.0.1:9999/jwks.json" }),
    ).resolves.toBeTypeOf("function");
  });

  it("refuses a redirect away from the URL that was vetted", async () => {
    // `fetch` follows redirects on its own, https to http included, so a
    // redirect would otherwise bypass the check above. jose requests with
    // `redirect: "manual"` and treats anything but 200 as a failure.
    const seen: string[] = [];
    const fetchImpl = ((target: URL | string) => {
      seen.push(String(target));
      return Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { location: "http://issuer.test/keys.json" },
        }),
      );
    }) as unknown as typeof fetch;

    const ring = await createJwksKeyRing({ url: URL_UNDER_TEST, fetchImpl });
    await expect(
      (ring as (header: { kid: string }) => Promise<unknown>)({
        kid: "key-1",
      }),
    ).rejects.toThrow();
    expect(seen).toEqual([URL_UNDER_TEST]);
  });

  it("reads a key set and answers with the key a token names", async () => {
    const fetchImpl = (() =>
      Promise.resolve(
        new Response(JSON.stringify({ keys: [pair.jwk] }), { status: 200 }),
      )) as unknown as typeof fetch;

    const ring = await createJwksKeyRing({ url: URL_UNDER_TEST, fetchImpl });
    await expect(
      (ring as (header: { kid: string; alg: string }) => Promise<unknown>)({
        kid: "key-1",
        alg: "RS256",
      }),
    ).resolves.toBeTruthy();
  });
});

describe("hmacKeyFromSecret", () => {
  it("refuses a secret short enough to be guessed offline", () => {
    expect(() => hmacKeyFromSecret("hunter2")).toThrow(KeySourceError);
  });

  it("accepts one of at least 32 bytes", () => {
    expect(hmacKeyFromSecret("x".repeat(32))).toHaveLength(32);
  });
});

describe("publicKeyFromPem", () => {
  it("reads an RSA public key", async () => {
    await expect(publicKeyFromPem(pair.spki)).resolves.toBeTruthy();
  });

  it("refuses something that is not a key", async () => {
    await expect(
      publicKeyFromPem("-----BEGIN PUBLIC KEY-----"),
    ).rejects.toThrow(KeySourceError);
  });

  it("refuses an RSA key below the size RS256 requires", async () => {
    // RFC 7518 sets the minimum at 2048 bits. jose checks that a key can be
    // used for RS256, not that it is large enough.
    await expect(publicKeyFromPem(await weakPublicKeyPem())).rejects.toThrow(
      /2048/,
    );
  });
});
