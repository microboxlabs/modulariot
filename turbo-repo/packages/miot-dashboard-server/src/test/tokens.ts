/**
 * Token minting for the identity tests.
 *
 * Real keys and real signatures, generated per run. A fixture token would
 * have to carry a fixed expiry and a committed private key, and the first of
 * those makes the suite fail on a date and the second puts a key in the
 * repository.
 */

import {
  exportJWK,
  exportSPKI,
  generateKeyPair,
  SignJWT,
  type CryptoKey,
} from "jose";

export interface TestKeyPair {
  privateKey: CryptoKey;
  publicKey: CryptoKey;
  /** The public half as a JWKS entry, for a faked endpoint. */
  jwk: Record<string, unknown>;
  /** The public half as PEM, for the pasted-key path. */
  spki: string;
  kid: string;
}

/**
 * 2048 bits rather than 4096: generation is the slow part of these tests, and
 * the size under test is the signature format, not the modulus.
 */
export async function generateTestKeyPair(
  kid: string,
  modulusLength = 2048,
): Promise<TestKeyPair> {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength,
    extractable: true,
  });
  return {
    privateKey,
    publicKey,
    jwk: { ...(await exportJWK(publicKey)), kid, use: "sig", alg: "RS256" },
    spki: await exportSPKI(publicKey),
    kid,
  };
}

/**
 * A public key too small for RS256, as PEM.
 *
 * `generateKeyPair` refuses to make one — jose enforces the floor when
 * generating, not when importing — so this goes through WebCrypto directly.
 */
export async function weakPublicKeyPem(): Promise<string> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 1024,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as { publicKey: CryptoKey };
  return exportSPKI(pair.publicKey);
}

export interface MintOptions {
  header?: Record<string, unknown>;
  claims: Record<string, unknown>;
}

const sign = (
  algorithm: string,
  key: CryptoKey | Uint8Array,
  options: MintOptions,
): Promise<string> =>
  new SignJWT(options.claims)
    .setProtectedHeader({ alg: algorithm, typ: "JWT", ...options.header })
    .sign(key);

/** A compact JWS signed with RS256. */
export const signRs256 = (key: CryptoKey, options: MintOptions) =>
  sign("RS256", key, options);

/** A compact JWS signed with HS256. `secret` may be any key material. */
export const signHs256 = (secret: Uint8Array | string, options: MintOptions) =>
  sign(
    "HS256",
    typeof secret === "string" ? new TextEncoder().encode(secret) : secret,
    options,
  );

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
