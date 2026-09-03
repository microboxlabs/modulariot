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
 *
 * The fetching, caching and parsing behind a JWKS endpoint is jose's. What is
 * ours is the policy: the URL may not be plaintext, and a key has to be big
 * enough to be worth verifying against.
 */

import type { KeyRing } from "./jwt";
import { isLoopbackHost } from "../net/loopback";

/** Thrown when the key source itself is unusable, never for a bad token. */
export class KeySourceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KeySourceError";
  }
}

/**
 * The smallest RSA modulus RS256 may be used with, from RFC 7518 §3.3.
 *
 * The same reasoning as the HS256 minimum below: a key smaller than this is
 * factorable by someone who wants to be, and then they mint their own tokens.
 */
const MIN_RSA_MODULUS_BITS = 2048;

/**
 * An HMAC key from a configured secret.
 *
 * Refuses anything under 32 bytes. HS256 keys are guessable in exactly the
 * way passwords are, the secret is usually typed by a person, and a short one
 * lets an attacker mint tokens for any user in any tenant offline.
 */
export function hmacKeyFromSecret(secret: string): Uint8Array {
  const key = new TextEncoder().encode(secret);
  if (key.length < 32) {
    throw new KeySourceError(
      `An HS256 secret must be at least 32 bytes; this one is ${key.length}. ` +
        "It is the only thing standing between a caller and any identity in " +
        "any tenant, so it has to be long enough not to be guessed offline.",
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

  // jose checks that the key can carry RS256; it does not check that the key
  // is large enough for the guarantee to mean anything.
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
   * Shortest interval between fetches provoked by an unknown key id. Without
   * one, a caller sending tokens with random `kid` values turns every request
   * into an outbound fetch, which is a denial of service against the identity
   * provider that we would be performing on their behalf.
   */
  minRefreshSeconds?: number;
  requestTimeoutMs?: number;
  /** Injected in tests. jose's own hook, so it sees every request it makes. */
  fetchImpl?: typeof fetch;
}

/**
 * A JWKS URL must be https, unless it is loopback.
 *
 * The document behind this URL decides which signatures are trusted, so
 * fetching it over plaintext hands that decision to anyone on the path.
 * Loopback is exempt so a fake provider can be run in tests and locally.
 *
 * A redirect cannot get around this: jose asks for the key set with
 * `redirect: "manual"` and treats anything but a 200 as a failure, so the
 * only URL ever read is this one.
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

/**
 * Keys fetched from a JWKS endpoint, cached, refreshed on an unknown key id.
 *
 * `cooldownDuration` is what bounds that refresh: an unknown key id is what a
 * rotation looks like from here and is worth another fetch, but not one per
 * request, or a caller sending random key ids would have us flood the
 * identity provider on their behalf.
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
