/**
 * One server, more than one way to authenticate.
 *
 * A deployment can face both a front-end holding a JWT and a service holding a
 * ticket. Each resolver reads its own header and returns null for a request
 * that carries nothing it recognizes, so asking them in turn costs nothing and
 * needs no discriminator.
 *
 * A resolver that throws stops the chain. Its credential source is unavailable,
 * and continuing would let a second resolver answer a question the first could
 * not — turning an outage into a different identity rather than an error.
 */

import type { DashboardIdentity, IdentityResolver } from "../seams/identity";

export function createFirstMatchIdentityResolver(
  resolvers: readonly IdentityResolver<Request>[],
): IdentityResolver<Request> {
  if (resolvers.length === 0) {
    throw new TypeError(
      "An identity resolver chain needs at least one resolver; an empty one " +
        "would leave every request unauthenticated",
    );
  }

  return {
    async resolve(request: Request): Promise<DashboardIdentity | null> {
      for (const resolver of resolvers) {
        const identity = await resolver.resolve(request);
        if (identity !== null) return identity;
      }
      return null;
    },
  };
}
