/**
 * Where verification keys come from.
 *
 * Which source is configured also determines the algorithm: a JWKS endpoint or
 * a public key means RS256, a shared secret means HS256. There is no way to
 * configure both, which is what prevents the algorithm confusion described in
 * `jwt.ts`.
 *
 * A JWKS endpoint is the normal choice. The other two exist because the target
 * cluster may have no egress: a key pasted into configuration verifies the same
 * tokens without reaching the identity provider, but has to be replaced by hand
 * when the provider rotates.
 *
 * jose does the fetching, caching and parsing. This module adds two rules: the
 * URL may not be plaintext, and an RSA key must be at least 2048 bits.
 */

import type { KeyRing } from "./jwt";
import { secureUrlProblem } from "../net/endpoint";

/** Thrown when the key source itself is unusable, never for a bad token. */
export class KeySourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KeySourceError";
  }
}

/**
 * The smallest RSA modulus RS256 may be used with, from RFC 7518 §3.3. A
 * smaller key can be factored, and whoever factors it can sign tokens.
 */
const MIN_RSA_MODULUS_BITS = 2048;

/**
 * An HMAC key from a configured secret.
 *
 * Refuses anything under 32 bytes. An HS256 secret is usually typed by a
 * person, and a short one can be brute-forced offline from a single token,
 * after which an attacker can sign tokens for any user in any tenant.
 */
export function hmacKeyFromSecret(secret: string): Uint8Array {
  const key = new TextEncoder().encode(secret);
  if (key.length < 32) {
    throw new KeySourceError(
      `An HS256 secret must be at least 32 bytes; this one is ${key.length}. ` +
        "A shorter one can be recovered offline from a single token, and " +
        "whoever recovers it can sign tokens for any user in any tenant.",
    );
  }
  return key;
}

/** An RSA public key from PEM: a public key block, or a certificate. */
export async function publicKeyFromPem(pem: string): Promise<KeyRing> {
  const { importSPKI, importX509 } = await import("jose");
  const isCertificate = pem.includes("BEGIN CERTIFICATE");

  let key: Awaited<ReturnType<typeof importSPKI>>;
  try {
    key = isCertificate
      ? await importX509(pem, "RS256")
      : await importSPKI(pem, "RS256");
  } catch (error) {
    throw new KeySourceError(
      "The configured public key could not be read. Expected PEM: a " +
        "-----BEGIN PUBLIC KEY----- block, or a certificate.",
      { cause: error },
    );
  }

  // jose checks that the key can be used for RS256, not that it is 2048 bits.
  const bits =
    "algorithm" in key && typeof key.algorithm === "object"
      ? ((key.algorithm as { modulusLength?: number }).modulusLength ?? 0)
      : 0;
  if (bits < MIN_RSA_MODULUS_BITS) {
    throw new KeySourceError(
      `RS256 needs an RSA key of at least ${MIN_RSA_MODULUS_BITS} bits; the ` +
        `configured public key is ${bits}.`,
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
   * Shortest interval between fetches triggered by an unknown key id. Without
   * one, a caller sending random `kid` values makes this server fetch the key
   * set once per request, flooding the identity provider.
   */
  minRefreshSeconds?: number;
  requestTimeoutMs?: number;
  /** Injected in tests. jose's own hook, so it covers every request jose makes. */
  fetchImpl?: typeof fetch;
}

/**
 * A JWKS URL must be https, unless it is loopback.
 *
 * The document at this URL determines which signatures are trusted, so anyone
 * able to modify it in transit can issue tokens for any user. Loopback is
 * exempt so a fake provider can be run in tests and locally.
 *
 * A redirect cannot bypass this: jose requests the key set with
 * `redirect: "manual"` and treats anything but a 200 as a failure, so this is
 * the only URL read.
 */
function checkJwksUrl(raw: string): URL {
  const problem = secureUrlProblem(raw, "The JWKS URL");
  if (problem !== null) throw new KeySourceError(problem);
  return new URL(raw);
}

/**
 * Keys fetched from a JWKS endpoint, cached, refetched on an unknown key id.
 *
 * An unknown key id usually means the provider rotated its keys, so one more
 * fetch is worth trying. `cooldownDuration` bounds how often.
 */
export async function createJwksKeyRing(
  options: JwksKeyRingOptions,
): Promise<KeyRing> {
  const url = checkJwksUrl(options.url);
  const { createRemoteJWKSet, customFetch } = await import("jose");

  return createRemoteJWKSet(url, {
    cacheMaxAge: (options.cacheSeconds ?? 600) * 1000,
    cooldownDuration: (options.minRefreshSeconds ?? 30) * 1000,
    timeoutDuration: options.requestTimeoutMs ?? 5000,
    ...(options.fetchImpl ? { [customFetch]: options.fetchImpl } : {}),
  });
}
