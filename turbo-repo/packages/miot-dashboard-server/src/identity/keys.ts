/**
 * Where verification keys come from.
 *
 * Three sources, and which one is configured is also what pins the algorithm:
 * a JWKS endpoint or a public key means RS256, a shared secret means HS256.
 * There is deliberately no way to configure "accept both" — that is the
 * algorithm-confusion attack described in `jwt.ts`, and the cleanest defence
 * is to make it inexpressible.
 *
 * A JWKS endpoint is the normal choice. The other two exist because the
 * target cluster may have no egress: a key pasted into configuration verifies
 * the same tokens without reaching the identity provider at all, at the cost
 * of having to be replaced by hand when the provider rotates.
 */

import { createPublicKey, type KeyObject } from "node:crypto";
import { isLoopbackHost } from "../net/loopback";
import type { KeyRing, VerificationKey } from "./jwt";

/** Thrown when the key source itself is unusable, never for a bad token. */
export class KeySourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KeySourceError";
  }
}

/** One key for every token, whatever `kid` the token names. */
export function createStaticKeyRing(key: VerificationKey): KeyRing {
  return { resolve: () => Promise.resolve(key) };
}

/**
 * An HMAC key from a configured secret.
 *
 * Refuses anything under 32 bytes. HS256 keys are guessable in exactly the
 * way passwords are, the secret is usually typed by a person, and a short one
 * lets an attacker mint tokens for any user in any tenant offline.
 */
export function hmacKeyFromSecret(secret: string): Buffer {
  const key = Buffer.from(secret, "utf8");
  if (key.length < 32) {
    throw new KeySourceError(
      `An HS256 secret must be at least 32 bytes; this one is ${key.length}. ` +
        "It is the only thing standing between a caller and any identity in " +
        "any tenant, so it has to be long enough not to be guessed offline.",
    );
  }
  return key;
}

/**
 * The smallest RSA modulus RS256 may be used with, from RFC 7518 §3.3.
 *
 * The same reasoning as the HS256 minimum above: a key below this is
 * factorable by someone who wants to be, and then they mint their own tokens.
 */
const MIN_RSA_MODULUS_BITS = 2048;

/** Rejects an RSA key too small to stand behind the signatures it verifies. */
function checkRsaKey(key: KeyObject, what: string): KeyObject {
  if (key.asymmetricKeyType !== "rsa") {
    throw new KeySourceError(
      `RS256 needs an RSA public key; ${what} is ${String(key.asymmetricKeyType)}.`,
    );
  }
  const bits = key.asymmetricKeyDetails?.modulusLength ?? 0;
  if (bits < MIN_RSA_MODULUS_BITS) {
    throw new KeySourceError(
      `RS256 needs an RSA key of at least ${MIN_RSA_MODULUS_BITS} bits; ` +
        `${what} is ${bits}.`,
    );
  }
  return key;
}

/** An RSA public key from PEM (SPKI, PKCS#1 or a certificate). */
export function publicKeyFromPem(pem: string): KeyObject {
  let key: KeyObject;
  try {
    key = createPublicKey(pem);
  } catch (error) {
    throw new KeySourceError(
      "The configured public key could not be read. Expected PEM: a " +
        "-----BEGIN PUBLIC KEY----- block, or a certificate.",
      { cause: error },
    );
  }
  return checkRsaKey(key, "the configured public key");
}

export interface JwksKeyRingOptions {
  /** The JWKS endpoint, e.g. https://tenant.auth0.com/.well-known/jwks.json */
  url: string;
  /** How long a fetched key set is used before being fetched again. */
  cacheSeconds?: number;
  /**
   * Shortest interval between fetches provoked by an unknown key id. Without
   * one, a caller sending tokens with random `kid` values turns every request
   * into an outbound fetch, which is a denial of service against the identity
   * provider that we would be performing on their behalf.
   */
  minRefreshSeconds?: number;
  requestTimeoutMs?: number;
  /** Injected in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface JsonWebKey {
  kty?: unknown;
  kid?: unknown;
  use?: unknown;
  alg?: unknown;
  n?: unknown;
  e?: unknown;
}

/** One megabyte of JWKS is already absurd; anything larger is not a key set. */
const MAX_JWKS_BYTES = 1024 * 1024;

/** Redirects are followed by hand, so the chain needs its own bound. */
const MAX_JWKS_REDIRECTS = 3;

/**
 * A JWKS URL must be https, unless it is loopback.
 *
 * The document behind this URL decides which signatures are trusted, so
 * fetching it over plaintext hands that decision to anyone on the path.
 * Loopback is exempt so a fake provider can be run in tests and locally.
 */
function checkJwksUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new KeySourceError(`"${raw}" is not a URL`);
  }
  if (url.protocol !== "https:" && !isLoopbackHost(url.hostname)) {
    throw new KeySourceError(
      `The JWKS URL must use https (got "${url.protocol}//"). It decides ` +
        "which signatures this server trusts, so anyone able to answer it " +
        "can issue tokens for any user.",
    );
  }
  return url;
}

function parseKeySet(body: unknown): Map<string, KeyObject> {
  const keys =
    typeof body === "object" &&
    body !== null &&
    Array.isArray((body as { keys?: unknown }).keys)
      ? (body as { keys: unknown[] }).keys
      : null;
  if (keys === null) {
    throw new KeySourceError('The JWKS document has no "keys" array');
  }

  const parsed = new Map<string, KeyObject>();
  for (const entry of keys) {
    if (typeof entry !== "object" || entry === null) continue;
    const jwk = entry as JsonWebKey;
    // Signature keys only: an encryption key in the same document must never
    // be accepted for verification, and a non-RSA key cannot serve RS256.
    if (jwk.kty !== "RSA") continue;
    if (jwk.use !== undefined && jwk.use !== "sig") continue;
    if (jwk.alg !== undefined && jwk.alg !== "RS256") continue;
    if (typeof jwk.kid !== "string") continue;
    try {
      parsed.set(
        jwk.kid,
        checkRsaKey(
          createPublicKey({ key: jwk as never, format: "jwk" }),
          `the key "${jwk.kid}"`,
        ),
      );
    } catch {
      // One unreadable or undersized key must not cost us the rest of the set.
    }
  }
  if (parsed.size === 0) {
    throw new KeySourceError(
      "The JWKS document contains no usable RS256 signing key",
    );
  }
  return parsed;
}

/**
 * Keys fetched from a JWKS endpoint, cached, refreshed on an unknown key id.
 *
 * When a refresh fails and keys are already cached, the cached ones keep
 * being used: the identity provider being briefly unreachable should not log
 * out everyone holding a valid token. When nothing is cached there is nothing
 * to fall back to, and the error propagates so the request fails as a server
 * fault rather than as a rejected credential.
 */
export function createJwksKeyRing(options: JwksKeyRingOptions): KeyRing {
  const url = checkJwksUrl(options.url);
  const cacheMs = (options.cacheSeconds ?? 600) * 1000;
  const minRefreshMs = (options.minRefreshSeconds ?? 30) * 1000;
  const timeoutMs = options.requestTimeoutMs ?? 5000;
  const now = options.now ?? Date.now;
  const fetchImpl = options.fetchImpl ?? fetch;

  let keys = new Map<string, KeyObject>();
  // Negative infinity rather than zero, so the first call counts as overdue
  // whatever the clock reads.
  let fetchedAt = Number.NEGATIVE_INFINITY;
  /**
   * When a fetch was last started, successful or not. `fetchedAt` moves only
   * on success, so a failure would otherwise leave the cache permanently
   * stale and every later call would try again.
   */
  let attemptedAt = Number.NEGATIVE_INFINITY;
  /** Reported again during the cooldown, so the caller learns the cause. */
  let lastFailure: unknown = null;
  /** Concurrent misses share one fetch rather than starting one each. */
  let inFlight: Promise<void> | null = null;

  /**
   * Fetch the key set, checking every hop of a redirect.
   *
   * `fetch` follows redirects on its own, and it follows them from https to
   * http without complaint. Only the first URL passes through `checkJwksUrl`,
   * so an automatic redirect is a way around the https requirement: the keys
   * that decide which signatures this server trusts would arrive in clear
   * text. Following them here means each `Location` is checked like the
   * original.
   */
  async function fetchKeySet(): Promise<Response> {
    let target = url;
    for (let hop = 0; hop <= MAX_JWKS_REDIRECTS; hop += 1) {
      const response = await fetchImpl(target, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { accept: "application/json" },
        redirect: "manual",
      });
      if (response.status < 300 || response.status >= 400) return response;

      const location = response.headers.get("location");
      if (location === null) {
        throw new KeySourceError(
          `The JWKS endpoint answered ${response.status} with no location`,
        );
      }
      target = checkJwksUrl(new URL(location, target).toString());
    }
    throw new KeySourceError(
      `The JWKS endpoint redirected more than ${MAX_JWKS_REDIRECTS} times`,
    );
  }

  async function load(): Promise<void> {
    const response = await fetchKeySet();
    if (!response.ok) {
      throw new KeySourceError(`The JWKS endpoint answered ${response.status}`);
    }
    const declared = Number(response.headers.get("content-length") ?? "0");
    if (declared > MAX_JWKS_BYTES) {
      throw new KeySourceError("The JWKS document is implausibly large");
    }
    const text = await response.text();
    if (text.length > MAX_JWKS_BYTES) {
      throw new KeySourceError("The JWKS document is implausibly large");
    }
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch (error) {
      throw new KeySourceError("The JWKS endpoint did not answer JSON", {
        cause: error,
      });
    }
    keys = parseKeySet(body);
    fetchedAt = now();
  }

  function refresh(): Promise<void> {
    attemptedAt = now();
    inFlight ??= load().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  /**
   * Attempt a refresh, unless one was attempted too recently.
   *
   * `inFlight` only merges calls that overlap. Sequential ones each started
   * their own fetch, so a provider that is down turned every request into
   * another attempt that waited for the timeout before answering: latency on
   * all authenticated traffic, and a retry storm aimed at a service that is
   * already struggling. The interval that already bounded refetching on an
   * unknown key id bounds this too.
   */
  async function refreshOrKeepCache(): Promise<void> {
    // A fetch already running is one to wait for, not a recent attempt to
    // back off from: the callers that arrive while the very first fetch is in
    // flight would otherwise be told the endpoint had not been read yet.
    if (inFlight === null && now() - attemptedAt < minRefreshMs) {
      // Still cooling down. With keys cached the stale ones are the right
      // answer; with none, the last failure is, because a missing key would
      // reach the caller as a rejected credential rather than an outage.
      if (keys.size > 0) return;
      throw (
        lastFailure ??
        new KeySourceError("The JWKS endpoint has not been read yet")
      );
    }
    try {
      await refresh();
      lastFailure = null;
    } catch (error) {
      lastFailure = error;
      if (keys.size === 0) throw error;
    }
  }

  return {
    async resolve(keyId) {
      if (keys.size === 0 || now() - fetchedAt > cacheMs) {
        await refreshOrKeepCache();
      }

      // A token with no `kid` is only resolvable when the set is unambiguous.
      const lookup = (): KeyObject | null =>
        keyId === undefined
          ? keys.size === 1
            ? (keys.values().next().value ?? null)
            : null
          : (keys.get(keyId) ?? null);

      const hit = lookup();
      if (hit !== null) return hit;

      // An unknown key id is what a rotation looks like from here, so it is
      // worth one more fetch — but not one per request.
      // `>=` rather than `>`, so `minRefreshSeconds: 0` means what it says.
      if (now() - attemptedAt >= minRefreshMs) {
        await refreshOrKeepCache();
        return lookup();
      }
      return null;
    },
  };
}
