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
  if (key.asymmetricKeyType !== "rsa") {
    throw new KeySourceError(
      `RS256 needs an RSA public key; this one is ${String(key.asymmetricKeyType)}.`,
    );
  }
  return key;
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
  const loopback =
    url.hostname === "localhost" ||
    url.hostname === "::1" ||
    url.hostname === "[::1]" ||
    url.hostname.startsWith("127.");
  if (url.protocol !== "https:" && !loopback) {
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
        createPublicKey({ key: jwk as never, format: "jwk" }),
      );
    } catch {
      // One unreadable key must not cost us the rest of the set.
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
  let fetchedAt = 0;
  let attemptedAt = 0;
  /** Concurrent misses share one fetch rather than starting one each. */
  let inFlight: Promise<void> | null = null;

  async function load(): Promise<void> {
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: "application/json" },
    });
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

  async function refreshOrKeepCache(): Promise<void> {
    try {
      await refresh();
    } catch (error) {
      // Nothing cached means there is no answer to give but the failure.
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
