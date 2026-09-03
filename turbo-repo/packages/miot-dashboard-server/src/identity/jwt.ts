/**
 * JWT verification, delegated to jose.
 *
 * What is left here is the part that is ours: which algorithm is accepted,
 * and the distinction between a credential we refuse and a key source we
 * could not reach. Everything else — parsing, signatures, `crit`, the
 * registered claims and their boundaries — is jose's, and the reason is that
 * the two defects a review found in the hand-written version were both of the
 * form "the specification says X and I did Y because Y was friendlier".
 *
 * The one property worth stating outright, because a library does not supply
 * it: `algorithm` comes from configuration and is passed to jose as the only
 * one it may accept. A verifier that takes the algorithm from the token can be
 * defeated with the RS256 public key — which is published — used as an HS256
 * shared secret. `jwtVerify` will accept whatever the key supports unless it
 * is told otherwise, so telling it is not optional.
 */

import type { CryptoKey, JWTPayload, KeyObject } from "jose";

/** The algorithms this package verifies. Each is pinned per configuration. */
export const JWT_ALGORITHMS = ["RS256", "HS256"] as const;
export type JwtAlgorithm = (typeof JWT_ALGORITHMS)[number];

/** RS256 verifies against a public key; HS256 against a secret's bytes. */
export type VerificationKey = CryptoKey | KeyObject | Uint8Array;

/**
 * Resolves the key for a token, as jose's `jwtVerify` takes it: either one key
 * or a function that picks one per token, which is what a JWKS endpoint is.
 */
export type KeyRing =
  | VerificationKey
  | ((header: { kid?: string; alg?: string }) => Promise<VerificationKey>);

export type JwtClaims = JWTPayload;

/**
 * A token that must not be trusted. Every rejection uses this type, so a
 * caller can turn the whole class into one 401 without enumerating the
 * reasons — and without the reasons reaching the client, where they would
 * describe our verification to whoever is probing it.
 */
export class JwtVerificationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "JwtVerificationError";
  }
}

export interface VerifyJwtOptions {
  keys: KeyRing;
  /** Pinned by configuration, and the only algorithm jose is allowed. */
  algorithm: JwtAlgorithm;
  issuer: string;
  audience: readonly string[];
  /** Seconds of allowed clock difference on `exp` and `nbf`. */
  clockToleranceSeconds?: number;
  /** Injected so expiry is testable without waiting. */
  now?: () => number;
}

/**
 * jose error codes that mean the token is bad rather than that we are.
 *
 * Anything not listed — a timeout, a socket error, a JWKS endpoint answering
 * something other than 200 — is an availability failure and propagates. A 401
 * there would sign out everyone holding a valid token for as long as the
 * identity provider is unreachable.
 */
const REFUSAL_CODES = new Set([
  "ERR_JWT_EXPIRED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JOSE_ALG_NOT_ALLOWED",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JWKS_MULTIPLE_MATCHING_KEYS",
]);

function codeOf(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/**
 * Verify a compact JWS and return its claims.
 *
 * Throws `JwtVerificationError` for anything wrong with the token. Anything
 * else thrown means the key source is unavailable.
 */
export async function verifyJwt(
  token: string,
  options: VerifyJwtOptions,
): Promise<JwtClaims> {
  const { jwtVerify } = await import("jose");
  try {
    const { payload } = await jwtVerify(token, options.keys, {
      algorithms: [options.algorithm],
      issuer: options.issuer,
      audience: [...options.audience],
      clockTolerance: options.clockToleranceSeconds ?? 30,
      // A token with no expiry never stops being valid, and a stolen bearer
      // credential that never expires is the whole problem.
      requiredClaims: ["exp"],
      ...(options.now ? { currentDate: new Date(options.now()) } : {}),
    });
    return payload;
  } catch (error) {
    const code = codeOf(error);
    if (code !== undefined && REFUSAL_CODES.has(code)) {
      throw new JwtVerificationError(
        error instanceof Error ? error.message : code,
      );
    }
    throw error;
  }
}
