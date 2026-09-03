/**
 * Turns the identity half of the configuration into a resolver.
 *
 * Separate from `bin.ts` so it can be tested. This is where a key source
 * becomes a key, and where a misconfiguration has to fail at startup rather
 * than leave the server running and refusing every request.
 */

import {
  createJwksKeyRing,
  createJwtIdentityResolver,
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

/**
 * jose is an optional peer dependency. Report its absence at startup rather
 * than as a module error on the first request carrying a token.
 */
async function requireJose(): Promise<void> {
  try {
    await import("jose");
  } catch (error) {
    throw new ConfigError(
      "JWT authentication needs the `jose` package, which this server treats " +
        "as an optional dependency so that a host mounting the library " +
        "without it installs nothing. Run `npm install jose`. " +
        `(${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function keyRingFor(
  auth: JwtAuthConfig,
  options: BuildIdentityOptions,
): Promise<{ keys: KeyRing; describe: string }> {
  switch (auth.key.kind) {
    case "jwks":
      return {
        keys: await createJwksKeyRing({
          url: auth.key.url,
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        }),
        describe: `keys from ${auth.key.url}`,
      };
    case "publicKey":
      return {
        keys: await publicKeyFromPem(auth.key.pem),
        describe: "keys from a configured public key",
      };
    case "secret":
      return {
        keys: hmacKeyFromSecret(auth.key.secret),
        describe: "keys from a configured shared secret",
      };
  }
}

export async function buildIdentityResolver(
  auth: AuthConfig,
  options: BuildIdentityOptions = {},
): Promise<AssembledIdentity> {
  if (auth.kind === "insecure") {
    return {
      identity: createInsecureHeaderIdentityResolver(),
      describe: "unverified request headers (local use only)",
    };
  }

  await requireJose();

  let keys: KeyRing;
  let keyDescription: string;
  try {
    ({ keys, describe: keyDescription } = await keyRingFor(auth, options));
  } catch (error) {
    // A key that cannot be read is a configuration problem: report it and
    // exit, rather than start and refuse every request.
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
