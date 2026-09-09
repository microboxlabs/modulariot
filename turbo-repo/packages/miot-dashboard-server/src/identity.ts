/**
 * The `./identity` entry: verifying identity resolvers.
 *
 * Separate from the core for the same reason `./store-sql` is. The core takes
 * an `IdentityResolver` and does not care where it came from; a host that
 * already authenticates its own requests supplies one and never loads any of
 * this. Only the standalone server, and a host with no identity layer of its
 * own, needs what is here.
 *
 * This entry is the only part of the package that uses `jose`, which is an
 * optional peer dependency and is imported when a key source is built rather
 * than when the module loads.
 *
 * It covers all three halves of `seams/identity.ts`. `IdentityResolver` says
 * who is calling, from a JWT this server verifies itself or from a ticket its
 * emitter validates. `TenantAuthority` says whether they may act in the
 * tenant the request names, and `ScopeAuthority` what their standing is in a
 * scope inside it — both by asking whatever system already knows.
 */

export {
  JWT_ALGORITHMS,
  JwtVerificationError,
  verifyJwt,
  type JwtAlgorithm,
  type JwtClaims,
  type KeyRing,
  type VerificationKey,
  type VerifyJwtOptions,
} from "./identity/jwt";

export {
  createJwksKeyRing,
  hmacKeyFromSecret,
  publicKeyFromPem,
  KeySourceError,
  type JwksKeyRingOptions,
} from "./identity/keys";

export {
  createJwtIdentityResolver,
  type JwtClaimMapping,
  type JwtIdentityOptions,
} from "./identity/resolver";

export {
  createTicketIdentityResolver,
  type TicketClaimPaths,
  type TicketIdentityOptions,
  type TicketPresentation,
} from "./identity/ticket";

export { createFirstMatchIdentityResolver } from "./identity/chain";

export {
  createHttpScopeAuthority,
  type HttpScopeAuthorityOptions,
} from "./identity/scope-http";

export {
  createHttpTenantAuthority,
  type HttpTenantAuthorityOptions,
} from "./identity/tenant-http";
