/**
 * Identity seam — the origin of every authorization decision in this package.
 *
 * The host answers one question: who is this request, and which tenant are
 * they in? Everything downstream (persistence, datasource queries, embed
 * tokens) derives its tenant scope from the answer.
 *
 * The critical rule, and the reason this seam exists at all: `tenantId` is
 * resolved from the *credential*, never from the request path or body. A
 * caller may name any scope they like in a URL; if it doesn't belong to the
 * tenant their credential resolves to, the request is refused. That single
 * invariant is what entitles @microboxlabs/miot-dashboard-ui to stay
 * tenant-unaware.
 */

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

export interface DashboardIdentity {
  /** Host-defined stable user identifier. */
  userId: string;
  /**
   * Host-defined tenant identifier. Resolved from the credential. Every
   * store call and datasource query is scoped by this value.
   */
  tenantId: string;
  kind: DashboardPrincipalKind;
  displayName?: string;
  /** Host authority ids (groups, roles) used to evaluate dashboard permissions. */
  groups?: string[];
  /**
   * Set only for `kind: "embed"` — the single dashboard the token was minted
   * for. Present means the principal may touch nothing else.
   */
  embedScope?: { scopeId: string; slug: string };
  /**
   * Ceiling on what this principal may do, before per-dashboard permissions
   * are applied. An embed token can only ever narrow, never widen.
   */
  capabilities: DashboardCapabilities;
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
  resolve(request: TRequest): Promise<DashboardIdentity | null>;
}
