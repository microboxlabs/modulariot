/**
 * The verifying identity resolver: a bearer JWT in, a `DashboardIdentity` out.
 *
 * The rule from `seams/identity.ts` is enforced here: `tenantId` is read from
 * a claim in the signed token and from nowhere else. No header, query
 * parameter or path segment can change it.
 *
 * There is no default tenant claim. No registered claim carries a tenant and
 * every provider uses a different name, so a wrong default would put every
 * caller in the same tenant without any error. The claim name is required
 * configuration.
 */

import { FULL_CAPABILITIES } from "../access/roles";
import type {
  DashboardIdentity,
  DashboardPrincipalKind,
  IdentityResolver,
} from "../seams/identity";
import {
  JwtVerificationError,
  verifyJwt,
  type JwtAlgorithm,
  type JwtClaims,
  type KeyRing,
} from "./jwt";

export interface JwtClaimMapping {
  /** Claim carrying the tenant. Required; see the note above. */
  tenantId: string;
  /** Claim carrying the user id. Defaults to `sub`. */
  userId?: string;
  /**
   * Claim carrying group or role ids, as an array or as a string of
   * space- or comma-separated values. These are matched against the
   * `authorityId` of a permission assignment, so they have to be the ids the
   * host stores, not display names.
   */
  groups?: string;
  /** Claim carrying a human-readable name. Defaults to `name`. */
  displayName?: string;
}

export interface JwtIdentityOptions {
  issuer: string;
  audience: string | readonly string[];
  /** Pinned here, never read from the token. */
  algorithm: JwtAlgorithm;
  keys: KeyRing;
  claims: JwtClaimMapping;
  clockToleranceSeconds?: number;
  now?: () => number;
  /**
   * Called with a short reason each time a presented credential is refused.
   *
   * The response is a 401 with no detail. The reason goes here instead, so
   * that a misconfiguration can be diagnosed. It never contains the token or
   * any claim value, so it is safe to log.
   */
  onReject?: (reason: string) => void;
  /**
   * How a service principal is distinguished from a person. The default reads
   * Auth0's `gty: "client-credentials"`, which a machine-to-machine token
   * carries, and falls back to the `@clients` suffix Auth0 puts on their `sub`.
   */
  principalKind?: (claims: JwtClaims) => DashboardPrincipalKind;
}

/** Auth0 appends this to the `sub` of a machine-to-machine token. */
const CLIENT_SUBJECT = "@clients";

function defaultPrincipalKind(claims: JwtClaims): DashboardPrincipalKind {
  if (claims.gty === "client-credentials") return "service";
  if (typeof claims.sub === "string" && claims.sub.endsWith(CLIENT_SUBJECT)) {
    return "service";
  }
  return "user";
}

/**
 * A claim read as an identifier. Numbers are converted to strings: a provider
 * with numeric tenant ids will send a number, and refusing it would break the
 * server for no security benefit.
 */
function readIdentifier(claims: JwtClaims, claim: string): string | null {
  const value = claims[claim];
  if (typeof value === "string" && value.length > 0) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readGroups(claims: JwtClaims, claim: string | undefined): string[] {
  if (claim === undefined) return [];
  const value = claims[claim];
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\s]+/)
      : [];
  return raw
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

/**
 * The token from an `Authorization` header, or null when there is none.
 *
 * Split on whitespace rather than matched with a pattern: `Bearer` followed by
 * two spaces is still a bearer credential, and a pattern applied to an
 * attacker-controlled header produced a high-severity ReDoS finding here
 * before.
 */
function bearerToken(header: string | null): string | null {
  if (header === null) return null;
  const parts = header.trim().split(/\s+/);
  if (parts.length !== 2) return null;
  const [scheme, token] = parts as [string, string];
  return scheme.toLowerCase() === "bearer" && token.length > 0 ? token : null;
}

export function createJwtIdentityResolver(
  options: JwtIdentityOptions,
): IdentityResolver<Request> {
  const audience =
    typeof options.audience === "string"
      ? [options.audience]
      : [...options.audience];
  if (audience.length === 0) {
    throw new TypeError(
      "A JWT identity resolver needs at least one audience. Without it any " +
        "token this issuer signed — including one minted for a different " +
        "API — would be accepted here.",
    );
  }
  if (options.claims.tenantId.length === 0) {
    throw new TypeError("A JWT identity resolver needs a tenant claim name");
  }

  const kindOf = options.principalKind ?? defaultPrincipalKind;
  const reject = (reason: string): null => {
    options.onReject?.(reason);
    return null;
  };

  return {
    async resolve(request: Request): Promise<DashboardIdentity | null> {
      const token = bearerToken(request.headers.get("authorization"));
      // No credential is an anonymous request, not a refusal. Reporting it
      // would log every unauthenticated request.
      if (token === null) return null;

      let claims: JwtClaims;
      try {
        claims = await verifyJwt(token, {
          keys: options.keys,
          algorithm: options.algorithm,
          issuer: options.issuer,
          audience,
          ...(options.clockToleranceSeconds === undefined
            ? {}
            : { clockToleranceSeconds: options.clockToleranceSeconds }),
          ...(options.now === undefined ? {} : { now: options.now }),
        });
      } catch (error) {
        if (error instanceof JwtVerificationError) return reject(error.message);
        // The key source failed. Answering 401 would reject every valid
        // token for as long as the identity provider is unreachable.
        throw error;
      }

      const tenantId = readIdentifier(claims, options.claims.tenantId);
      if (tenantId === null) {
        return reject(
          `the token carries no usable "${options.claims.tenantId}" claim, ` +
            "which is the claim this server reads the tenant from",
        );
      }

      const userClaim = options.claims.userId ?? "sub";
      const userId = readIdentifier(claims, userClaim);
      if (userId === null) {
        return reject(`the token carries no usable "${userClaim}" claim`);
      }

      const groups = readGroups(claims, options.claims.groups);
      const displayName = readIdentifier(
        claims,
        options.claims.displayName ?? "name",
      );

      return {
        userId,
        tenantId,
        kind: kindOf(claims),
        // An upper bound, not a grant: what this principal may do on a
        // dashboard is decided by the scope authority and the permission
        // assignments.
        capabilities: { ...FULL_CAPABILITIES },
        ...(groups.length > 0 ? { groups } : {}),
        ...(displayName === null ? {} : { displayName }),
      };
    },
  };
}
