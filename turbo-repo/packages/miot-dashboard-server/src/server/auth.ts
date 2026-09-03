/**
 * Turns the identity half of the configuration into a resolver.
 *
 * Lives here rather than inside `bin.ts` so it can be tested: the assembly is
 * where a key source becomes a key, and where a misconfiguration has to
 * become a startup failure instead of a server that runs and refuses
 * everyone.
 */

import {
  createJwksKeyRing,
  createJwtIdentityResolver,
  createStaticKeyRing,
  hmacKeyFromSecret,
  KeySourceError,
  publicKeyFromPem,
} from "../identity";
import type { KeyRing } from "../identity/jwt";
import type { IdentityResolver } from "../seams/identity";
import { createInsecureHeaderIdentityResolver } from "../testing";
import { ConfigError, type AuthConfig, type JwtAuthConfig } from "./config";

export interface AssembledIdentity {
  identity: IdentityResolver<Request>;
  /** One line for the startup log. Never contains key material. */
  describe: string;
}

export interface BuildIdentityOptions {
  /** Receives the reason a presented credential was refused. */
  onReject?: (reason: string) => void;
  /** Injected in tests so a JWKS endpoint can be faked. */
  fetchImpl?: typeof fetch;
}

function keyRingFor(
  auth: JwtAuthConfig,
  options: BuildIdentityOptions,
): { keys: KeyRing; describe: string } {
  switch (auth.key.kind) {
    case "jwks":
      return {
        keys: createJwksKeyRing({
          url: auth.key.url,
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        }),
        describe: `keys from ${auth.key.url}`,
      };
    case "publicKey":
      return {
        keys: createStaticKeyRing(publicKeyFromPem(auth.key.pem)),
        describe: "keys from a configured public key",
      };
    case "secret":
      return {
        keys: createStaticKeyRing(hmacKeyFromSecret(auth.key.secret)),
        describe: "keys from a configured shared secret",
      };
  }
}

export function buildIdentityResolver(
  auth: AuthConfig,
  options: BuildIdentityOptions = {},
): AssembledIdentity {
  if (auth.kind === "insecure") {
    return {
      identity: createInsecureHeaderIdentityResolver(),
      describe: "unverified request headers (local use only)",
    };
  }

  let keys: KeyRing;
  let keyDescription: string;
  try {
    ({ keys, describe: keyDescription } = keyRingFor(auth, options));
  } catch (error) {
    // A key that cannot be read is a configuration problem, and the process
    // should say so and exit rather than start and refuse every request.
    if (error instanceof KeySourceError) {
      throw new ConfigError(error.message);
    }
    throw error;
  }

  return {
    identity: createJwtIdentityResolver({
      issuer: auth.issuer,
      audience: auth.audience,
      algorithm: auth.algorithm,
      keys,
      claims: {
        tenantId: auth.claims.tenantId,
        ...(auth.claims.userId ? { userId: auth.claims.userId } : {}),
        ...(auth.claims.groups ? { groups: auth.claims.groups } : {}),
        ...(auth.claims.displayName
          ? { displayName: auth.claims.displayName }
          : {}),
      },
      clockToleranceSeconds: auth.clockToleranceSeconds,
      ...(options.onReject ? { onReject: options.onReject } : {}),
    }),
    describe:
      `${auth.algorithm} bearer tokens from ${auth.issuer} ` +
      `for ${auth.audience.join(", ")}, ${keyDescription}`,
  };
}
