/**
 * JWT verification, delegated to jose.
 *
 * This module adds two things jose does not decide: which algorithm is
 * accepted, and whether a failure is a refused credential or an unreachable
 * key source.
 *
 * `algorithm` comes from configuration and is passed to jose as the only
 * algorithm it may accept. `jwtVerify` otherwise accepts any algorithm the key
 * supports, and a verifier that takes the algorithm from the token can be
 * defeated: the RS256 public key is published, so an attacker signs an HS256
 * token using it as the shared secret.
 */

import type { CryptoKey, JWTPayload, KeyObject } from "jose";

/** The algorithms this package verifies. Each is pinned per configuration. */
export const JWT_ALGORITHMS = ["RS256", "HS256"] as const;
export type JwtAlgorithm = (typeof JWT_ALGORITHMS)[number];

/** RS256 verifies against a public key; HS256 against a secret's bytes. */
export type VerificationKey = CryptoKey | KeyObject | Uint8Array;

/** One key, or a function that selects one per token, as a JWKS endpoint does. */
export type KeyRing =
  | VerificationKey
  | ((header: { kid?: string; alg?: string }) => Promise<VerificationKey>);

export type JwtClaims = JWTPayload;

/**
 * A token that must not be trusted. Every rejection uses this type, so a
 * caller can answer 401 without enumerating the reasons, and the reasons stay
 * out of the response.
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
  /** Injected so expiry can be tested without waiting. */
  now?: () => number;
}

/**
 * jose error codes that mean the token is invalid.
 *
 * Anything not listed — a timeout, a socket error, a JWKS endpoint answering
 * something other than 200 — means the identity provider is unreachable and
 * propagates. Answering 401 there would reject every valid token for the
 * duration of the outage.
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
      // jose does not require `exp`. A token without one is valid forever.
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
