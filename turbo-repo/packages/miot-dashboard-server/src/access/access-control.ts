/**
 * Access control — the single enforcement point for tenancy and capabilities.
 *
 * Every service in this package (persistence, datasource proxy, embed
 * tokens) calls `authorize` first and acts only on the decision it returns.
 * Adapters do the same before handing a request to a service. Nothing else
 * in the package consults the identity, scope or capability seams directly,
 * so the isolation guarantee lives in exactly one function and the test
 * suite that pins it.
 *
 * The order inside `authorize` is the guarantee:
 *
 *   1. identity — from the credential; none → 401
 *   2. scope    — the URL's `scopeId` checked against that identity; no
 *                 standing → 403 TENANT_SCOPE, and *no store call has
 *                 happened yet*, so the response cannot reveal whether the
 *                 scope exists
 *   3. dashboard (when the target names one) — record and assignments
 *                 loaded under the credential's tenant, capabilities
 *                 resolved, ceiling applied
 *   4. action   — the capability the action needs; missing → 403 CAPABILITY
 *
 * Every denial is audited. Every allowed decision is audited too, as the
 * record that an attempt was permitted; whether the operation then succeeded
 * is the operation's own event.
 */

import type { AuditAction, AuditSink } from "../seams/audit";
import { noopAuditSink } from "../seams/audit";
import type {
  DashboardCapabilities,
  DashboardIdentity,
  IdentityResolver,
  ScopeAuthority,
} from "../seams/identity";
import type {
  DashboardRecord,
  PermissionAssignment,
  ServerDashboardRef,
  ServerDashboardStore,
} from "../seams/store";
import { roleCapabilityPolicy, type CapabilityPolicy } from "./capabilities";
import { DashboardServerError, type ForbiddenReason } from "./errors";
import {
  capabilitiesForRole,
  intersectCapabilities,
  roleAtLeast,
  type DashboardRole,
} from "./roles";

/** Everything a caller can ask permission for. Token redemption is identity resolution, not an action. */
export type DashboardAction = Exclude<AuditAction, "embed.token.redeem">;

export interface AccessTarget {
  scopeId: string;
  /** Required for dashboard-level actions; optional for scope-level ones. */
  slug?: string;
  action: DashboardAction;
}

export interface DashboardAccess {
  ref: ServerDashboardRef;
  /** Null when the dashboard does not exist yet. */
  record: DashboardRecord | null;
  assignments: PermissionAssignment[];
  /** Effective capabilities: policy result intersected with the principal's ceiling. */
  capabilities: DashboardCapabilities;
}

export interface AccessDecision {
  identity: DashboardIdentity;
  scopeId: string;
  scopeRole: DashboardRole;
  /** Present when the target named a dashboard. */
  dashboard?: DashboardAccess;
}

export interface AccessControlOptions<TRequest> {
  identity: IdentityResolver<TRequest>;
  scopes: ScopeAuthority;
  store: ServerDashboardStore;
  /** Defaults to `roleCapabilityPolicy`. */
  policy?: CapabilityPolicy;
  /** Defaults to discarding events. */
  audit?: AuditSink;
  /**
   * Called when the audit sink throws or rejects. The operation is never
   * failed for it; this is the hook for logging that it happened.
   */
  onAuditError?: (error: unknown) => void;
  /** Clock, for tests. */
  now?: () => Date;
}

export interface AccessControl<TRequest> {
  /** Authorize one action against one target, or throw a `DashboardServerError`. */
  authorize(request: TRequest, target: AccessTarget): Promise<AccessDecision>;
  /**
   * The caller's effective capabilities on one dashboard — the server half
   * of the UI package's Seam F. Throws 403 when the caller cannot see the
   * dashboard at all and 404 when it does not exist.
   */
  capabilities(
    request: TRequest,
    scopeId: string,
    slug: string,
  ): Promise<DashboardCapabilities>;
}

/**
 * Capability flags an action can require. `readOnly` is deliberately absent:
 * it is a rendering hint for the UI, never a gate on the server.
 */
type CapabilityName = Exclude<keyof DashboardCapabilities, "readOnly">;

type ActionRule =
  /** Names one dashboard; a slug is mandatory and its capabilities decide. */
  | { level: "dashboard"; capability: CapabilityName | null }
  /** Acts on the scope; the caller's role in it decides, plus their ceiling. */
  | { level: "scope"; floor: DashboardRole; capability: CapabilityName | null };

/**
 * What every action requires. One table, consulted by both the scope-level
 * and dashboard-level paths, for two reasons:
 *
 * `Record<DashboardAction, ActionRule>` is exhaustive, so a new action cannot
 * be authorized by omission. `DashboardAction` is derived from the audit
 * vocabulary, which means adding an audit verb also adds an authorization
 * verb; before this table, such a verb inherited a permissive default and was
 * allowed to every scope member. Now it fails to compile until someone says
 * what it needs.
 *
 * `capability` is checked on both paths. When it was checked only on the
 * dashboard path, omitting the slug skipped the caller's ceiling entirely —
 * a restricted principal could write to a datasource by leaving the slug out
 * of a request that would have been refused with it.
 */
const ACTION_RULES: Readonly<Record<DashboardAction, ActionRule>> = {
  "dashboard.list": { level: "scope", floor: "Consumer", capability: null },
  "dashboard.load": { level: "dashboard", capability: null },
  "dashboard.save": { level: "dashboard", capability: "canEdit" },
  "dashboard.delete": { level: "dashboard", capability: "canDelete" },
  "dashboard.permissions.read": {
    level: "dashboard",
    capability: "canManagePermissions",
  },
  "dashboard.permissions.write": {
    level: "dashboard",
    capability: "canManagePermissions",
  },
  "datasource.list": { level: "scope", floor: "Consumer", capability: null },
  "datasource.query": { level: "scope", floor: "Consumer", capability: null },
  // Write-back is scope-level on purpose: the app's existing routes address a
  // function, not a dashboard, and P6 has to strangle them as they are.
  "datasource.write": {
    level: "scope",
    floor: "Contributor",
    capability: "canEdit",
  },
  "embed.token.issue": { level: "dashboard", capability: "canShare" },
};

/**
 * What an embed principal may do at all. Rendering needs the config and its
 * queries; everything else — listing, editing, sharing onward — is refused
 * regardless of what the token claims. Widening this is a P7 decision, to be
 * made together with the token format, not by a token.
 */
const EMBED_ACTIONS: ReadonlySet<DashboardAction> = new Set<DashboardAction>([
  "dashboard.load",
  "datasource.query",
]);

/**
 * Whether the dashboard's effective capabilities cover the action. Those are
 * already intersected with the caller's ceiling, so no further narrowing is
 * needed here.
 *
 * Creating a dashboard is the one case decided by scope standing instead:
 * a dashboard that does not exist yet has no capabilities to consult.
 */
function dashboardActionAllowed(
  action: DashboardAction,
  access: DashboardAccess,
  scopeRole: DashboardRole,
): boolean {
  if (action === "dashboard.save" && access.record === null) {
    return roleAtLeast(scopeRole, "Contributor");
  }
  const { capability } = ACTION_RULES[action];
  return capability === null || access.capabilities[capability];
}

/**
 * Whether a scope-level action is allowed: the caller's role in the scope
 * must clear the floor, and their ceiling must still permit it.
 */
function scopeActionAllowed(
  action: DashboardAction,
  identity: DashboardIdentity,
  scopeRole: DashboardRole,
): boolean {
  const rule = ACTION_RULES[action];
  if (rule.level !== "scope") return false;
  if (!roleAtLeast(scopeRole, rule.floor)) return false;
  return rule.capability === null || identity.capabilities[rule.capability];
}

function targetLabel(target: AccessTarget): string {
  return target.slug === undefined
    ? target.scopeId
    : `${target.scopeId}/${target.slug}`;
}

export function createAccessControl<TRequest>(
  options: AccessControlOptions<TRequest>,
): AccessControl<TRequest> {
  const {
    identity: identities,
    scopes,
    store,
    policy = roleCapabilityPolicy,
    audit = noopAuditSink,
    onAuditError,
    now = () => new Date(),
  } = options;

  async function record(
    identity: DashboardIdentity | null,
    target: AccessTarget,
    outcome: "allowed" | "denied",
    detail?: Record<string, string | number | boolean>,
  ): Promise<void> {
    try {
      await audit.record({
        at: now().toISOString(),
        ...(identity
          ? { tenantId: identity.tenantId, userId: identity.userId }
          : {}),
        action: target.action,
        outcome,
        target: targetLabel(target),
        ...(detail ? { detail } : {}),
      });
    } catch (error) {
      onAuditError?.(error);
    }
  }

  async function deny(
    identity: DashboardIdentity | null,
    target: AccessTarget,
    reason: ForbiddenReason,
    message: string,
  ): Promise<never> {
    await record(identity, target, "denied", {
      reason,
      principal: identity?.kind ?? "anonymous",
    });
    throw DashboardServerError.forbidden(reason, message);
  }

  async function loadDashboard(
    identity: DashboardIdentity,
    target: AccessTarget & { slug: string },
    scopeRole: DashboardRole,
    resolveCapabilities: (
      record: DashboardRecord | null,
      assignments: PermissionAssignment[],
    ) => Promise<DashboardCapabilities | null>,
  ): Promise<DashboardAccess | null> {
    // tenantId comes from the credential, never from the target: this is the
    // one place a store reference is assembled, and it cannot name another
    // tenant.
    const ref: ServerDashboardRef = {
      tenantId: identity.tenantId,
      scopeId: target.scopeId,
      slug: target.slug,
    };
    const dashboardRecord = await store.load(ref);
    const assignments = dashboardRecord ? await store.getPermissions(ref) : [];
    const granted = await resolveCapabilities(dashboardRecord, assignments);
    if (granted === null) return null;
    return {
      ref,
      record: dashboardRecord,
      assignments,
      capabilities: intersectCapabilities(granted, identity.capabilities),
    };
  }

  async function authorizeEmbed(
    identity: DashboardIdentity,
    target: AccessTarget,
  ): Promise<AccessDecision> {
    const scope = identity.embedScope;
    if (
      !scope ||
      !EMBED_ACTIONS.has(target.action) ||
      target.scopeId !== scope.scopeId ||
      (target.slug !== undefined && target.slug !== scope.slug)
    ) {
      return deny(
        identity,
        target,
        "EMBED_SCOPE",
        "This embed token does not grant access to the requested resource",
      );
    }
    // Embedded viewers are read-only at this phase whatever the token says;
    // the ceiling still applies on top, so a narrower token stays narrower.
    const viewer = capabilitiesForRole("Consumer");
    const decision: AccessDecision = {
      identity,
      scopeId: target.scopeId,
      scopeRole: "Consumer",
    };
    if (target.slug !== undefined) {
      const dashboard = await loadDashboard(
        identity,
        { ...target, slug: target.slug },
        "Consumer",
        async () => viewer,
      );
      // The policy is bypassed above, so this branch cannot deny.
      if (dashboard) decision.dashboard = dashboard;
    }
    await record(identity, target, "allowed", { principal: identity.kind });
    return decision;
  }

  async function authorizeUser(
    identity: DashboardIdentity,
    target: AccessTarget,
  ): Promise<AccessDecision> {
    const scopeRole = await scopes.resolveScopeRole(identity, target.scopeId);
    if (scopeRole === null) {
      return deny(
        identity,
        target,
        "TENANT_SCOPE",
        "The requested scope is not accessible with these credentials",
      );
    }

    if (target.slug === undefined) {
      if (ACTION_RULES[target.action].level === "dashboard") {
        // Audited like any other refusal. This one indicts the adapter rather
        // than the caller, but it is reachable from a request, and a burst of
        // them is worth seeing in the log rather than only in a 400.
        await record(identity, target, "denied", {
          reason: "BAD_REQUEST",
          principal: identity.kind,
        });
        throw DashboardServerError.badRequest(
          `Action ${target.action} requires a dashboard slug`,
        );
      }
      if (!scopeActionAllowed(target.action, identity, scopeRole)) {
        return deny(
          identity,
          target,
          "CAPABILITY",
          `Your role in this scope does not allow ${target.action}`,
        );
      }
      await record(identity, target, "allowed", {
        principal: identity.kind,
        scopeRole,
      });
      return { identity, scopeId: target.scopeId, scopeRole };
    }

    const slugTarget = { ...target, slug: target.slug };
    const dashboard = await loadDashboard(
      identity,
      slugTarget,
      scopeRole,
      (dashboardRecord, assignments) =>
        Promise.resolve(
          policy.resolve({
            identity,
            ref: {
              tenantId: identity.tenantId,
              scopeId: target.scopeId,
              slug: slugTarget.slug,
            },
            scopeRole,
            assignments,
            record: dashboardRecord,
          }),
        ),
    );
    if (dashboard === null) {
      return deny(
        identity,
        target,
        "CAPABILITY",
        "You do not have access to this dashboard",
      );
    }
    if (!dashboardActionAllowed(target.action, dashboard, scopeRole)) {
      return deny(
        identity,
        target,
        "CAPABILITY",
        `Your capabilities on this dashboard do not allow ${target.action}`,
      );
    }
    await record(identity, target, "allowed", {
      principal: identity.kind,
      scopeRole,
    });
    return { identity, scopeId: target.scopeId, scopeRole, dashboard };
  }

  async function authorize(
    request: TRequest,
    target: AccessTarget,
  ): Promise<AccessDecision> {
    const identity = await identities.resolve(request);
    if (identity === null) {
      await record(null, target, "denied", { reason: "UNAUTHENTICATED" });
      throw DashboardServerError.unauthenticated();
    }
    return identity.kind === "embed"
      ? authorizeEmbed(identity, target)
      : authorizeUser(identity, target);
  }

  async function capabilities(
    request: TRequest,
    scopeId: string,
    slug: string,
  ): Promise<DashboardCapabilities> {
    const decision = await authorize(request, {
      scopeId,
      slug,
      action: "dashboard.load",
    });
    if (!decision.dashboard || decision.dashboard.record === null) {
      throw DashboardServerError.notFound("Dashboard not found");
    }
    return decision.dashboard.capabilities;
  }

  return { authorize, capabilities };
}
