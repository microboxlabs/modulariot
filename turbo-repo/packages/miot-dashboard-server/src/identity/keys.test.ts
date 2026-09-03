import { generateKeyPairSync } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { generateTestKeyPair, type TestKeyPair } from "../test/tokens";
import {
  createJwksKeyRing,
  hmacKeyFromSecret,
  KeySourceError,
  publicKeyFromPem,
} from "./keys";

let first: TestKeyPair;
let second: TestKeyPair;

beforeAll(() => {
  first = generateTestKeyPair("key-1");
  second = generateTestKeyPair("key-2");
});

const URL_UNDER_TEST = "https://issuer.test/.well-known/jwks.json";

interface FakeEndpoint {
  fetchImpl: typeof fetch;
  calls: number;
  /** Swap the key set the endpoint answers with, as a rotation would. */
  serve(keys: Record<string, unknown>[]): void;
  fail(error: Error): void;
}

function fakeJwks(keys: Record<string, unknown>[]): FakeEndpoint {
  let body = { keys };
  let failure: Error | null = null;
  const endpoint: FakeEndpoint = {
    calls: 0,
    serve(next) {
      body = { keys: next };
      failure = null;
    },
    fail(error) {
      failure = error;
    },
    fetchImpl: (() => {
      endpoint.calls += 1;
      if (failure !== null) return Promise.reject(failure);
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );
    }) as unknown as typeof fetch,
  };
  return endpoint;
}

describe("createJwksKeyRing", () => {
  it("fetches the key set once and answers from the cache after that", async () => {
    const endpoint = fakeJwks([first.jwk, second.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });

    await expect(ring.resolve("key-1")).resolves.toBeTruthy();
    await expect(ring.resolve("key-2")).resolves.toBeTruthy();
    expect(endpoint.calls).toBe(1);
  });

  it("shares one fetch between callers that miss at the same time", async () => {
    const endpoint = fakeJwks([first.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });

    await Promise.all([
      ring.resolve("key-1"),
      ring.resolve("key-1"),
      ring.resolve("key-1"),
    ]);
    expect(endpoint.calls).toBe(1);
  });

  it("fetches again when the provider rotates to a key it has not seen", async () => {
    const endpoint = fakeJwks([first.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
      minRefreshSeconds: 0,
    });

    await expect(ring.resolve("key-1")).resolves.toBeTruthy();
    endpoint.serve([first.jwk, second.jwk]);
    await expect(ring.resolve("key-2")).resolves.toBeTruthy();
    expect(endpoint.calls).toBe(2);
  });

  it("does not fetch once per request for an unknown key id", async () => {
    // Otherwise a caller sending random key ids turns every request into an
    // outbound fetch, and we perform a denial of service against the identity
    // provider on their behalf.
    let clock = 1_000_000;
    const endpoint = fakeJwks([first.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
      minRefreshSeconds: 30,
      now: () => clock,
    });

    await ring.resolve("key-1");
    expect(endpoint.calls).toBe(1);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      clock += 1000;
      await expect(ring.resolve(`made-up-${attempt}`)).resolves.toBeNull();
    }
    expect(endpoint.calls).toBe(1);

    // Past the interval, one more attempt is allowed.
    clock += 30_000;
    await expect(ring.resolve("made-up-again")).resolves.toBeNull();
    expect(endpoint.calls).toBe(2);
  });

  it("keeps serving cached keys while the provider is unreachable", async () => {
    let clock = 1_000_000;
    const endpoint = fakeJwks([first.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
      cacheSeconds: 10,
      now: () => clock,
    });

    await expect(ring.resolve("key-1")).resolves.toBeTruthy();
    endpoint.fail(new Error("connect ECONNREFUSED"));
    clock += 60_000;

    // The cache is stale and the refresh fails; the alternative to using it
    // is signing out everyone holding a valid token.
    await expect(ring.resolve("key-1")).resolves.toBeTruthy();
  });

  it("reports the failure when there is no cache to fall back on", async () => {
    const endpoint = fakeJwks([first.jwk]);
    endpoint.fail(new Error("connect ECONNREFUSED"));
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });

    await expect(ring.resolve("key-1")).rejects.toThrow("ECONNREFUSED");
  });

  it("uses the only key when a token names none", async () => {
    const endpoint = fakeJwks([first.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });
    await expect(ring.resolve(undefined)).resolves.toBeTruthy();
  });

  it("will not guess when a token names no key and the set has several", async () => {
    const endpoint = fakeJwks([first.jwk, second.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });
    await expect(ring.resolve(undefined)).resolves.toBeNull();
  });

  it("ignores keys that are not RS256 signing keys", async () => {
    const encryptionKey = { ...first.jwk, kid: "enc", use: "enc" };
    const symmetric = { kty: "oct", kid: "oct", k: "c2VjcmV0" };
    const endpoint = fakeJwks([encryptionKey, symmetric, second.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });

    await expect(ring.resolve("enc")).resolves.toBeNull();
    await expect(ring.resolve("oct")).resolves.toBeNull();
    await expect(ring.resolve("key-2")).resolves.toBeTruthy();
  });

  it("refuses a JWKS document with nothing usable in it", async () => {
    const endpoint = fakeJwks([{ kty: "oct", kid: "oct", k: "c2VjcmV0" }]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });
    await expect(ring.resolve("oct")).rejects.toThrow(/no usable RS256/);
  });

  it("ignores a key too small to stand behind its signatures", () => {
    const weak = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const jwk = {
      ...weak.publicKey.export({ format: "jwk" }),
      kid: "weak",
      use: "sig",
      alg: "RS256",
    } as Record<string, unknown>;
    const endpoint = fakeJwks([jwk, second.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
    });

    return Promise.all([
      expect(ring.resolve("weak")).resolves.toBeNull(),
      expect(ring.resolve("key-2")).resolves.toBeTruthy(),
    ]);
  });

  it("does not retry a failing provider once per request", async () => {
    // `inFlight` only merges calls that overlap. Sequential ones each started
    // their own fetch, so an outage meant every request waited for the
    // timeout and the provider got a retry storm from us.
    let clock = 1_000_000;
    const endpoint = fakeJwks([first.jwk]);
    endpoint.fail(new Error("connect ECONNREFUSED"));
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
      minRefreshSeconds: 30,
      now: () => clock,
    });

    for (let attempt = 0; attempt < 50; attempt += 1) {
      clock += 100;
      await expect(ring.resolve("key-1")).rejects.toThrow("ECONNREFUSED");
    }
    expect(endpoint.calls).toBe(1);

    clock += 30_000;
    await expect(ring.resolve("key-1")).rejects.toThrow("ECONNREFUSED");
    expect(endpoint.calls).toBe(2);
  });

  it("does not refetch on every request once a cached set goes stale", async () => {
    let clock = 1_000_000;
    const endpoint = fakeJwks([first.jwk]);
    const ring = createJwksKeyRing({
      url: URL_UNDER_TEST,
      fetchImpl: endpoint.fetchImpl,
      cacheSeconds: 10,
      minRefreshSeconds: 30,
      now: () => clock,
    });

    await ring.resolve("key-1");
    endpoint.fail(new Error("connect ECONNREFUSED"));

    // Past the cache lifetime, so every call finds the set stale. A failed
    // refresh does not move `fetchedAt`, which is what made this retry
    // forever.
    for (let attempt = 0; attempt < 20; attempt += 1) {
      clock += 11_000;
      await expect(ring.resolve("key-1")).resolves.toBeTruthy();
    }
    expect(endpoint.calls).toBeLessThanOrEqual(8);
  });

  describe("redirects", () => {
    /** Answers one redirect, then the key set. */
    const redirectingTo = (location: string) => {
      const seen: string[] = [];
      const fetchImpl = ((target: URL) => {
        seen.push(target.toString());
        if (seen.length === 1) {
          return Promise.resolve(
            new Response(null, { status: 302, headers: { location } }),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ keys: [first.jwk] }), { status: 200 }),
        );
      }) as unknown as typeof fetch;
      return { fetchImpl, seen };
    };

    it("refuses a redirect that drops to plaintext http", async () => {
      // `fetch` follows redirects itself, and follows https to http without
      // complaint, so checking only the first URL is not checking the URL the
      // keys actually came from.
      const endpoint = redirectingTo("http://issuer.test/keys.json");
      const ring = createJwksKeyRing({
        url: URL_UNDER_TEST,
        fetchImpl: endpoint.fetchImpl,
      });

      await expect(ring.resolve("key-1")).rejects.toThrow(/https/);
      expect(endpoint.seen).toHaveLength(1);
    });

    it("follows one that stays on https", async () => {
      const endpoint = redirectingTo("https://cdn.issuer.test/keys.json");
      const ring = createJwksKeyRing({
        url: URL_UNDER_TEST,
        fetchImpl: endpoint.fetchImpl,
      });

      await expect(ring.resolve("key-1")).resolves.toBeTruthy();
      expect(endpoint.seen).toEqual([
        URL_UNDER_TEST,
        "https://cdn.issuer.test/keys.json",
      ]);
    });

    it("gives up on a redirect that never lands", async () => {
      const fetchImpl = (() =>
        Promise.resolve(
          new Response(null, {
            status: 302,
            headers: { location: "https://issuer.test/again" },
          }),
        )) as unknown as typeof fetch;
      const ring = createJwksKeyRing({ url: URL_UNDER_TEST, fetchImpl });

      await expect(ring.resolve("key-1")).rejects.toThrow(/redirected/);
    });
  });

  it("refuses to fetch its trust root over plaintext http", () => {
    // Whoever can answer this URL decides which signatures are trusted.
    expect(() =>
      createJwksKeyRing({ url: "http://issuer.test/.well-known/jwks.json" }),
    ).toThrow(KeySourceError);
  });

  it("allows http on loopback, so a fake provider can be run locally", () => {
    expect(() =>
      createJwksKeyRing({ url: "http://127.0.0.1:9999/jwks.json" }),
    ).not.toThrow();
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
  it("reads an RSA public key", () => {
    const pem = first.publicKey.export({
      type: "spki",
      format: "pem",
    }) as string;
    expect(publicKeyFromPem(pem).asymmetricKeyType).toBe("rsa");
  });

  it("refuses something that is not a key", () => {
    expect(() => publicKeyFromPem("-----BEGIN PUBLIC KEY-----")).toThrow(
      KeySourceError,
    );
  });

  it("refuses a key of the wrong type for RS256", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const pem = publicKey.export({ type: "spki", format: "pem" }) as string;
    expect(() => publicKeyFromPem(pem)).toThrow(/RSA/);
  });

  it("refuses an RSA key below the size RS256 requires", () => {
    // RFC 7518 puts the floor at 2048 bits; the same reasoning as the
    // minimum length on an HS256 secret.
    const { publicKey } = generateKeyPairSync("rsa", { modulusLength: 1024 });
    const pem = publicKey.export({ type: "spki", format: "pem" }) as string;
    expect(() => publicKeyFromPem(pem)).toThrow(/2048/);
  });
});
