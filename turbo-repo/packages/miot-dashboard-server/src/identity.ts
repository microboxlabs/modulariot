/**
 * The `./identity` entry: verifying identity resolvers.
 *
 * Separate from the core for the same reason `./store-sql` is. The core takes
 * an `IdentityResolver` and does not care where it came from; a host that
 * already authenticates its own requests supplies one and never loads any of
 * this. Only the standalone server, and a host with no identity layer of its
 * own, needs what is here.
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
  createStaticKeyRing,
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
