/**
 * JWT verification.
 *
 * Deliberately small: two algorithms, one of them chosen by configuration
 * rather than read from the token, and the registered claims. Everything a
 * general JOSE library offers beyond that (encrypted tokens, EdDSA, key
 * agreement) is surface this package does not need and would have to defend.
 *
 * The one property worth stating outright, because it is the difference
 * between a verifier and a vulnerability: `algorithm` comes from the caller
 * and the token's own `alg` header is only ever compared against it, never
 * used to select anything. A verifier that reads `alg` and then picks a key
 * accordingly can be defeated with the RS256 public key — which is published
 * — used as an HS256 shared secret. Comparing also rejects `alg: "none"`
 * without needing a rule about it.
 */

import {
  createHmac,
  timingSafeEqual,
  verify,
  type KeyObject,
} from "node:crypto";

/** The algorithms this package verifies. Each is pinned per configuration. */
export const JWT_ALGORITHMS = ["RS256", "HS256"] as const;
export type JwtAlgorithm = (typeof JWT_ALGORITHMS)[number];

/** RS256 verifies against a public key; HS256 against a shared secret. */
export type VerificationKey = KeyObject | Buffer;

export interface JwtClaims {
  iss?: unknown;
  sub?: unknown;
  aud?: unknown;
  exp?: unknown;
  nbf?: unknown;
  iat?: unknown;
  [claim: string]: unknown;
}

/**
 * Supplies the key a token should be verified against.
 *
 * Returning `null` means "no key with that id", which is a rejected token.
 * Throwing means the key source itself failed, which is not the caller's
 * fault and must not be reported as a bad credential.
 */
export interface KeyRing {
  resolve(keyId: string | undefined): Promise<VerificationKey | null>;
}

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
  /** Pinned by configuration. The token's `alg` is compared against it. */
  algorithm: JwtAlgorithm;
  issuer: string;
  audience: readonly string[];
  /** Seconds of allowed clock difference on `exp` and `nbf`. */
  clockToleranceSeconds?: number;
  /** Milliseconds since the epoch. Injected so expiry is testable. */
  now?: () => number;
}

/** `typ` is optional, but a value we do not recognise is a different format. */
const ACCEPTED_TYPES = new Set(["jwt", "at+jwt", "application/at+jwt"]);

const BASE64URL = /^[A-Za-z0-9_-]*$/;

/**
 * `Buffer.from(value, "base64url")` drops characters it does not recognise
 * instead of failing, so a token can be mangled and still decode. The shape
 * is checked first and the result is exact.
 */
function decodeSegment(segment: string, what: string): Buffer {
  if (!BASE64URL.test(segment)) {
    throw new JwtVerificationError(`${what} is not base64url`);
  }
  return Buffer.from(segment, "base64url");
}

function decodeJson(segment: string, what: string): Record<string, unknown> {
  // Decoded outside the try: a `catch` around both steps reports every
  // malformed segment as bad JSON, including the ones that never got that far.
  const bytes = decodeSegment(segment, what);
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new JwtVerificationError(`${what} is not JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new JwtVerificationError(`${what} is not a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/**
 * Issuers are compared as strings, after removing one trailing slash from
 * each. Auth0 publishes its issuer with the slash and configuration is
 * routinely written without it; treating those as different issuers produces
 * a total outage whose cause is one character.
 */
function sameIssuer(a: string, b: string): boolean {
  const trim = (value: string) =>
    value.endsWith("/") ? value.slice(0, -1) : value;
  return trim(a) === trim(b);
}

function checkAudience(claim: unknown, accepted: readonly string[]): void {
  const values =
    typeof claim === "string"
      ? [claim]
      : Array.isArray(claim)
        ? claim.filter((entry): entry is string => typeof entry === "string")
        : [];
  if (values.length === 0) {
    throw new JwtVerificationError("token carries no audience");
  }
  if (!values.some((value) => accepted.includes(value))) {
    throw new JwtVerificationError("token audience is not this server");
  }
}

function requireSeconds(value: unknown, claim: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new JwtVerificationError(`${claim} is missing or not a number`);
  }
  return value;
}

function checkSignature(
  algorithm: JwtAlgorithm,
  signed: string,
  signature: Buffer,
  key: VerificationKey,
): void {
  const data = Buffer.from(signed, "ascii");
  let valid = false;

  if (algorithm === "HS256") {
    const expected = createHmac("sha256", key as Buffer)
      .update(data)
      .digest();
    // The length is checked first because timingSafeEqual throws when the
    // two buffers differ in length, and that throw would itself be the
    // comparison's answer.
    valid =
      expected.length === signature.length &&
      timingSafeEqual(expected, signature);
  } else {
    try {
      // Padding is left at the default, which for an RSA key is PKCS#1 v1.5
      // — what RS256 is defined as. PSS would be PS256.
      valid = verify("sha256", data, key as KeyObject, signature);
    } catch {
      // A malformed signature, or a key of the wrong type, is a bad token
      // rather than a server fault.
      valid = false;
    }
  }

  if (!valid) throw new JwtVerificationError("signature does not verify");
}

/**
 * Verify a compact JWS and return its claims.
 *
 * Throws `JwtVerificationError` for anything wrong with the token. Anything
 * else thrown came from the key ring and means the key source is unavailable.
 */
export async function verifyJwt(
  token: string,
  options: VerifyJwtOptions,
): Promise<JwtClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtVerificationError("token is not a compact JWS");
  }
  const [encodedHeader, encodedPayload, encodedSignature] = parts as [
    string,
    string,
    string,
  ];

  const header = decodeJson(encodedHeader, "header");
  if (header.alg !== options.algorithm) {
    // Not "unsupported algorithm": the configured one is the only algorithm
    // this server accepts, whatever else it could verify in principle.
    throw new JwtVerificationError(
      `token is signed with ${String(header.alg)}, this server accepts ${options.algorithm}`,
    );
  }
  if (
    typeof header.typ === "string" &&
    !ACCEPTED_TYPES.has(header.typ.toLowerCase())
  ) {
    throw new JwtVerificationError(`unexpected token type ${header.typ}`);
  }
  if (header.crit !== undefined) {
    // `crit` names extensions a verifier is required to understand. We
    // understand none, so a token carrying it cannot be verified correctly
    // and must not be verified at all.
    throw new JwtVerificationError("token requires unsupported extensions");
  }

  const keyId = typeof header.kid === "string" ? header.kid : undefined;
  const key = await options.keys.resolve(keyId);
  if (key === null) {
    throw new JwtVerificationError(
      keyId === undefined
        ? "token names no key and no default key is configured"
        : `no verification key with id ${keyId}`,
    );
  }

  checkSignature(
    options.algorithm,
    `${encodedHeader}.${encodedPayload}`,
    decodeSegment(encodedSignature, "signature"),
    key,
  );

  // Claims are read only once the signature holds. Reading them earlier would
  // mean acting on values an attacker chose.
  const claims = decodeJson(encodedPayload, "payload") as JwtClaims;

  if (
    typeof claims.iss !== "string" ||
    !sameIssuer(claims.iss, options.issuer)
  ) {
    throw new JwtVerificationError("token issuer is not the configured one");
  }
  checkAudience(claims.aud, options.audience);

  const tolerance = options.clockToleranceSeconds ?? 30;
  const now = Math.floor((options.now?.() ?? Date.now()) / 1000);

  // `exp` is required. A token without one never stops being valid, and a
  // stolen bearer credential that never expires is the whole problem.
  const exp = requireSeconds(claims.exp, "exp");
  if (now > exp + tolerance) {
    throw new JwtVerificationError("token has expired");
  }
  if (claims.nbf !== undefined) {
    const nbf = requireSeconds(claims.nbf, "nbf");
    if (now < nbf - tolerance) {
      throw new JwtVerificationError("token is not valid yet");
    }
  }

  return claims;
}
