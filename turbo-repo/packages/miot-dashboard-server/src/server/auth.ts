/**
 * Turns the identity half of the configuration into seam implementations.
 *
 * Separate from `bin.ts` so it can be tested. This is where a key source
 * becomes a key and a membership URL becomes a lookup, and where a
 * misconfiguration has to fail at startup rather than leave the server running
 * and refusing every request.
 */

import {
  createFirstMatchIdentityResolver,
  createHttpScopeAuthority,
  createJwksKeyRing,
  createJwtIdentityResolver,
  createTicketIdentityResolver,
  hmacKeyFromSecret,
  KeySourceError,
  publicKeyFromPem,
} from "../identity";
import type { KeyRing } from "../identity/jwt";
import { EndpointError } from "../net/endpoint";
import type { IdentityResolver, ScopeAuthority } from "../seams/identity";
import {
  createInsecureHeaderIdentityResolver,
  createMemoryScopeAuthority,
  type Memberships,
} from "../testing";
import {
  ConfigError,
  type AuthConfig,
  type HeaderCredential,
  type JwtAuthConfig,
  type ScopeConfig,
  type TicketAuthConfig,
} from "./config";

export interface AssembledIdentity {
  identity: IdentityResolver<Request>;
  /** One line for the startup log. Never contains key material. */
  describe: string;
}

export interface AssembledScopes {
  scopes: ScopeAuthority;
  describe: string;
}

export interface BuildIdentityOptions {
  /** Receives the reason a presented credential was refused. */
  onReject?: (reason: string) => void;
  /** Injected in tests so a host endpoint can be faked. */
  fetchImpl?: typeof fetch;
}

export interface BuildScopeOptions extends BuildIdentityOptions {
  /** Used only by the seed-backed authority. */
  memberships?: Memberships;
  now?: () => number;
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

const asHeaders = (
  credential: HeaderCredential | undefined,
): Record<string, string> =>
  credential === undefined ? {} : { [credential.name]: credential.value };

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

async function buildJwtResolver(
  auth: JwtAuthConfig,
  options: BuildIdentityOptions,
): Promise<AssembledIdentity> {
  await requireJose();

  let keys: KeyRing;
  let keyDescription: string;
  try {
    ({ keys, describe: keyDescription } = await keyRingFor(auth, options));
  } catch (error) {
    // A key that cannot be read is a configuration problem: report it and
    // exit, rather than start and refuse every request.
    if (error instanceof KeySourceError) throw new ConfigError(error.message);
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

function buildTicketResolver(
  auth: TicketAuthConfig,
  options: BuildIdentityOptions,
): AssembledIdentity {
  let identity: IdentityResolver<Request>;
  try {
    identity = createTicketIdentityResolver({
      header: auth.header,
      ...(auth.scheme === undefined ? {} : { scheme: auth.scheme }),
      url: auth.url,
      method: auth.method,
      present: auth.present,
      headers: asHeaders(auth.serviceHeader),
      tenant: auth.tenant,
      claims: {
        userId: auth.claims.userId,
        ...(auth.claims.groups ? { groups: auth.claims.groups } : {}),
        ...(auth.claims.displayName
          ? { displayName: auth.claims.displayName }
          : {}),
      },
      absentStatuses: auth.absentStatuses,
      cacheSeconds: auth.cacheSeconds,
      negativeCacheSeconds: auth.negativeCacheSeconds,
      requestTimeoutMs: auth.requestTimeoutMs,
      ...(options.onReject ? { onReject: options.onReject } : {}),
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
    });
  } catch (error) {
    if (error instanceof EndpointError) throw new ConfigError(error.message);
    throw error;
  }

  const tenant =
    auth.tenant.kind === "fixed"
      ? `tenant ${auth.tenant.tenantId}`
      : `tenant from "${auth.tenant.path}"`;
  return {
    identity,
    describe:
      `tickets from the "${auth.header}" header, validated at ${auth.url}, ` +
      `${tenant}, cached ${auth.cacheSeconds}s`,
  };
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

  const assembled: AssembledIdentity[] = [];
  if (auth.jwt !== undefined) {
    assembled.push(await buildJwtResolver(auth.jwt, options));
  }
  if (auth.ticket !== undefined) {
    assembled.push(buildTicketResolver(auth.ticket, options));
  }
  if (assembled.length === 0) {
    // Unreachable through readServerConfig, which refuses a verified
    // configuration with no scheme in it. Stated here so that a caller
    // assembling the config by hand gets an error rather than a server that
    // treats every request as anonymous.
    throw new ConfigError(
      "Verified authentication is configured with no scheme in it: set up " +
        "JWT verification, ticket validation, or both",
    );
  }

  return {
    identity:
      assembled.length === 1
        ? (assembled[0] as AssembledIdentity).identity
        : createFirstMatchIdentityResolver(
            assembled.map((one) => one.identity),
          ),
    describe: assembled.map((one) => one.describe).join("; also "),
  };
}

export function buildScopeAuthority(
  config: ScopeConfig,
  options: BuildScopeOptions = {},
): AssembledScopes {
  if (config.kind === "seed") {
    const memberships = options.memberships ?? {};
    return {
      scopes: createMemoryScopeAuthority(memberships),
      describe: `the seed file (${Object.keys(memberships).length} tenants)`,
    };
  }

  try {
    return {
      scopes: createHttpScopeAuthority({
        url: config.url,
        method: config.method,
        headers: asHeaders(config.serviceHeader),
        rolePath: config.rolePath,
        ...(config.roleMap ? { roleMap: config.roleMap } : {}),
        absentStatuses: config.absentStatuses,
        cacheSeconds: config.cacheSeconds,
        negativeCacheSeconds: config.negativeCacheSeconds,
        requestTimeoutMs: config.requestTimeoutMs,
        ...(options.onReject ? { onReject: options.onReject } : {}),
        ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        ...(options.now ? { now: options.now } : {}),
      }),
      describe: `${config.method} ${config.url}, cached ${config.cacheSeconds}s`,
    };
  } catch (error) {
    if (error instanceof EndpointError) throw new ConfigError(error.message);
    throw error;
  }
}
