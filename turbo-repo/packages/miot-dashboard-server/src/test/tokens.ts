/**
 * Token minting for the identity tests.
 *
 * Real keys and real signatures, generated per run. A fixture token would
 * have to carry a fixed expiry and a committed private key, and the first of
 * those makes the suite fail on a date and the second puts a key in the
 * repository.
 */

import {
  createHmac,
  createSign,
  generateKeyPairSync,
  type KeyObject,
} from "node:crypto";

export interface TestKeyPair {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** The public half as a JWKS entry, for a faked endpoint. */
  jwk: Record<string, unknown>;
  kid: string;
}

/**
 * 2048 bits rather than 4096: generation is the slow part of these tests, and
 * the size under test is the signature format, not the modulus.
 */
export function generateTestKeyPair(kid: string): TestKeyPair {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const jwk = {
    ...publicKey.export({ format: "jwk" }),
    kid,
    use: "sig",
    alg: "RS256",
  } as Record<string, unknown>;
  return { privateKey, publicKey, jwk, kid };
}

const encode = (value: unknown): string =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

export interface MintOptions {
  header?: Record<string, unknown>;
  claims: Record<string, unknown>;
}

/** A compact JWS signed with RS256. */
export function signRs256(key: KeyObject, options: MintOptions): string {
  const header = { alg: "RS256", typ: "JWT", ...options.header };
  const signed = `${encode(header)}.${encode(options.claims)}`;
  const signature = createSign("sha256")
    .update(signed)
    .sign(key)
    .toString("base64url");
  return `${signed}.${signature}`;
}

/** A compact JWS signed with HS256. `secret` may be any key material. */
export function signHs256(
  secret: Buffer | string,
  options: MintOptions,
): string {
  const header = { alg: "HS256", typ: "JWT", ...options.header };
  const signed = `${encode(header)}.${encode(options.claims)}`;
  const signature = createHmac("sha256", secret)
    .update(signed)
    .digest("base64url");
  return `${signed}.${signature}`;
}

/** An unsigned token, which is what `alg: "none"` means. */
export function signNone(options: MintOptions): string {
  const header = { alg: "none", typ: "JWT", ...options.header };
  return `${encode(header)}.${encode(options.claims)}.`;
}

/** Claims that pass every check, so a test can change one thing at a time. */
export function validClaims(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return {
    iss: "https://issuer.test/",
    aud: "miot-dashboards",
    sub: "auth0|alice",
    exp: nowSeconds + 3600,
    iat: nowSeconds,
    ...overrides,
  };
}
