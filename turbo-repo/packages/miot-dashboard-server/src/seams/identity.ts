/**
 * Identity seam — the origin of every authorization decision in this package.
 *
 * Three questions, answered by three seams, in this order:
 *
 * 1. `IdentityResolver` — who is calling? Produces a `DashboardPrincipal`,
 *    which has no tenant.
 * 2. `TenantAuthority` — may that principal act in the tenant the request
 *    names? Saying yes produces a `DashboardIdentity`, the principal bound to
 *    one tenant for the length of one request.
 * 3. `ScopeAuthority` — what is their standing in the scope inside it?
 *
 * The rule that matters: a caller names the tenant and the scope, and neither
 * is believed. Both are checked against a host that already knows the answer,
 * and a request that names either wrongly is refused. Binding the tenant to
 * the credential instead would be simpler, but it would force a person who
 * works in two tenants to hold two credentials and re-authenticate to switch.
 *
 * Every store call and datasource query is scoped by the bound `tenantId`,
 * which is what entitles @microboxlabs/miot-dashboard-ui to stay
 * tenant-unaware.
 */

import type { DashboardRole } from "../access/roles";

/** Capabilities mirror the UI package's Seam F vocabulary exactly. */
export interface DashboardCapabilities {
  readOnly: boolean;
  canEdit: boolean;
  canShare: boolean;
  canManagePermissions: boolean;
  canDelete: boolean;
}

/**
 * Deny-by-default capabilities — the correct starting point for any caller.
 *
 * Frozen, and typed `Readonly`, because this is a shared module-level object
 * in a long-lived server process: one caller mutating it in place would move
 * the deny-by-default baseline for every request that followed. Build a
 * widened set by spreading it, never by assigning through it.
 */
export const NO_CAPABILITIES: Readonly<DashboardCapabilities> = Object.freeze({
  readOnly: true,
  canEdit: false,
  canShare: false,
  canManagePermissions: false,
  canDelete: false,
});

/** How a request authenticated. Embed tokens are deliberately distinguishable. */
export type DashboardPrincipalKind = "user" | "embed" | "service";

/**
 * A caller, as the credential describes them. No tenant: a principal may be
 * entitled to act in several, and which one this request means is decided by
 * the `TenantAuthority` against the tenant the request names.
 */
export interface DashboardPrincipal {
  /** Host-defined stable user identifier. */
  userId: string;
  kind: DashboardPrincipalKind;
  displayName?: string;
  /** Host authority ids (groups, roles) used to evaluate dashboard permissions. */
  groups?: string[];
  /**
   * Set only for `kind: "embed"` — the single dashboard the token was minted
   * for. Present means the principal may touch nothing else, in no other
   * tenant. An embed token names its tenant because it is minted for one
   * dashboard, so there is nothing to switch between.
   */
  embedScope?: { tenantId: string; scopeId: string; slug: string };
  /**
   * Ceiling on what this principal may do, before per-dashboard permissions
   * are applied. An embed token can only ever narrow, never widen.
   */
  capabilities: DashboardCapabilities;
}

/**
 * A principal bound to the one tenant this request acts in.
 *
 * Only the access control constructs this, and only after the
 * `TenantAuthority` has allowed the pairing. Everything downstream takes this
 * type rather than `DashboardPrincipal`, so a store reference can never be
 * assembled from a tenant nobody authorized.
 */
export interface DashboardIdentity extends DashboardPrincipal {
  /**
   * Host-defined tenant identifier, taken from the request and authorized.
   * Every store call and datasource query is scoped by this value.
   */
  tenantId: string;
}

/**
 * Resolves a host-native request into an identity.
 *
 * Generic over the request type because the host owns it: a Next
 * `Request`, a Fastify `FastifyRequest`, or anything else. The package never
 * inspects it directly.
 *
 * Return `null` for an unauthenticated request — callers translate that into
 * 401. Throwing is reserved for genuine failures (identity provider down),
 * which must not be reported as "unauthenticated".
 */
export interface IdentityResolver<TRequest = unknown> {
  resolve(request: TRequest): Promise<DashboardPrincipal | null>;
}

/**
 * Answers whether a principal may act in the tenant a request names.
 *
 * This is the seam that lets one credential serve several tenants. The
 * request carries the tenant; this decides whether the pairing is allowed,
 * and only then does a `DashboardIdentity` exist.
 *
 * Return `false` for "not entitled" and for "no such tenant" alike — a caller
 * probing tenant ids must learn nothing from the answer. Throw only when the
 * question could not be answered: a host that is down must produce a 500, not
 * a refusal that locks out every valid caller for the length of the outage.
 *
 * For a deployment serving a single tenant this is `tenantId === THE_TENANT`.
 * There is no default: an implementation that allows by omission would put
 * every caller in every tenant.
 */
export interface TenantAuthority {
  mayActAs(principal: DashboardPrincipal, tenantId: string): Promise<boolean>;
}

/**
 * Answers the second half of the tenancy question: given who the caller is,
 * what is their standing in the scope a request names?
 *
 * `TenantAuthority` binds a principal to a tenant; this seam binds that
 * identity to a scope *inside* the tenant. The access control consults it
 * exactly once per request, before any store or datasource call, and it is
 * the only place a URL-supplied `scopeId` is ever checked against the
 * credential.
 *
 * Return `null` when the scope is not this principal's to see — because it
 * belongs to another tenant, because it does not exist, or because they hold
 * no membership in it. The three cases are deliberately indistinguishable:
 * a caller probing scope ids must learn nothing from the answer.
 *
 * For a host with one scope per tenant this is `scopeId === identity.tenantId
 * ? "Coordinator" : null`. There is no default: an implementation that grants
 * access by omission is the failure mode this package exists to prevent.
 *
 * `identity.tenantId` is already authorized by the time this is called, so an
 * implementation may use it to scope its own lookup without re-checking it.
 */
export interface ScopeAuthority {
  resolveScopeRole(
    identity: DashboardIdentity,
    scopeId: string,
  ): Promise<DashboardRole | null>;
}
