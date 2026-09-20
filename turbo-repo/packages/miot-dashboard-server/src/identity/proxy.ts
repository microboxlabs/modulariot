/**
 * Identity from a proxy that has already resolved it.
 *
 * A host that authenticates its own callers — the Quarkus modulith in front
 * of this server — knows the tenant and the scope role before it forwards.
 * This resolver lets it say so, instead of making this server ask the same
 * membership system a second time.
 *
 * The assertion never replaces the bearer token. `inner` still verifies it,
 * and the asserted user must match the identity it produced. A leaked proxy
 * key therefore cannot impersonate anyone: it only lets the holder change the
 * role of a user whose valid token they already have.
 */

import { timingSafeEqual } from "node:crypto";
import { isDashboardRole } from "../access/roles";
import type {
  AssertedClaims,
  DashboardPrincipal,
  IdentityResolver,
} from "../seams/identity";

/** Raised when the proxy headers are present and wrong. Becomes a 500. */
export class ProxyAssertionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProxyAssertionError";
  }
}

export interface TrustedProxyHeaders {
  /** Carries the shared key. Default `x-miot-proxy-key`. */
  key?: string;
  /** Carries the user id the proxy resolved. Default `x-miot-asserted-user`. */
  user?: string;
  /** Default `x-miot-asserted-tenant`. */
  tenant?: string;
  /** Default `x-miot-asserted-scope`. */
  scope?: string;
  /** Carries a `DashboardRole`. Default `x-miot-asserted-role`. */
  role?: string;
}

export interface TrustedProxyIdentityOptions {
  /**
   * Shared secret the proxy sends. Compared in constant time. The same value
   * has to be configured on both deployments.
   */
  key: string;
  /**
   * Verifies the bearer token. Its answer is the identity; the assertion only
   * adds tenant and role to it.
   */
  inner: IdentityResolver<Request>;
  headers?: TrustedProxyHeaders;
}

const DEFAULT_HEADERS: Required<TrustedProxyHeaders> = {
  key: "x-miot-proxy-key",
  user: "x-miot-asserted-user",
  tenant: "x-miot-asserted-tenant",
  scope: "x-miot-asserted-scope",
  role: "x-miot-asserted-role",
};

/**
 * Constant-time comparison. `timingSafeEqual` throws when the two buffers
 * differ in length, so a mismatched length is answered without calling it on
 * the pair.
 */
function secretsMatch(presented: string, expected: string): boolean {
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    // Compared against itself so the false branch does the same work.
    timingSafeEqual(b, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

function required(request: Request, header: string): string {
  const value = request.headers.get(header)?.trim();
  if (value === undefined || value.length === 0) {
    throw new ProxyAssertionError(
      `The proxy key was accepted but "${header}" is missing or empty. ` +
        "A proxy that authenticates itself must send a complete assertion.",
    );
  }
  return value;
}

export function createTrustedProxyIdentityResolver(
  options: TrustedProxyIdentityOptions,
): IdentityResolver<Request> {
  if (options.key.length === 0) {
    throw new TypeError(
      "A trusted-proxy identity resolver needs a non-empty key. An empty " +
        "one would accept any request that sends the header at all.",
    );
  }
  const headers = { ...DEFAULT_HEADERS, ...options.headers };

  return {
    async resolve(request: Request): Promise<DashboardPrincipal | null> {
      const presented = request.headers.get(headers.key);
      // No key header is an ordinary request. The standalone deployment takes
      // this path for everything.
      if (presented === null) return options.inner.resolve(request);

      if (!secretsMatch(presented, options.key)) {
        // Not a 401: a wrong key means the proxy and this server disagree
        // about their shared secret, and answering as if the caller were
        // anonymous would hide that behind ordinary 403s.
        throw new ProxyAssertionError(
          `The value of "${headers.key}" does not match the configured proxy key`,
        );
      }

      const principal = await options.inner.resolve(request);
      if (principal === null) {
        throw new ProxyAssertionError(
          "The proxy asserted an identity but the request carries no " +
            "credential this server could verify. The bearer token has to " +
            "be forwarded alongside the assertion.",
        );
      }

      const userId = required(request, headers.user);
      if (userId !== principal.userId) {
        // Without this, anyone holding the key could pair their own token
        // with an assertion naming somebody else.
        throw new ProxyAssertionError(
          "The asserted user does not match the verified credential",
        );
      }

      const role = required(request, headers.role);
      if (!isDashboardRole(role)) {
        throw new ProxyAssertionError(
          `"${role}" is not a dashboard role. The proxy has to map its own ` +
            "role names before asserting them.",
        );
      }

      const asserted: AssertedClaims = {
        tenantId: required(request, headers.tenant),
        scopeId: required(request, headers.scope),
        role,
      };
      return { ...principal, asserted };
    },
  };
}
