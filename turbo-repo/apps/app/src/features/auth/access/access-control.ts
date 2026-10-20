/**
 * Where access decisions come from, set by `ACCESS_CONTROL_SOURCE`:
 * - `groups`: Alfresco groups decide (default).
 * - `shadow`: groups decide; the permission decision is also computed and
 *   every mismatch is logged.
 * - `permissions`: the caller's IAM permissions in the active organization
 *   decide, and gates stay closed until they have loaded.
 */
export type AccessSource = "groups" | "shadow" | "permissions";

const SOURCES: readonly AccessSource[] = ["groups", "shadow", "permissions"];

export function parseAccessSource(value: string | undefined): AccessSource {
  const normalized = value?.trim().toLowerCase();
  return SOURCES.find((source) => source === normalized) ?? "groups";
}

/**
 * One gate. Groups and permissions are each satisfied by any one entry.
 * A rule without `requiredPermissions` is decided by groups in every mode.
 */
export interface AccessRule {
  readonly requiredGroups?: readonly string[];
  readonly blockedGroups?: readonly string[];
  readonly requiredPermissions?: readonly string[];
}

export interface AccessSubject {
  readonly groups: readonly string[];
  /** `null` while the permissions are still loading. */
  readonly permissions: readonly string[] | null;
}

export interface AccessDecision {
  readonly allowed: boolean;
  readonly byGroups: boolean;
  /** `null` when the permissions have not loaded yet. */
  readonly byPermissions: boolean | null;
  /** True when both decisions are known and they differ. */
  readonly mismatch: boolean;
}

export function hasPermissionMapping(rule: AccessRule): boolean {
  return (rule.requiredPermissions?.length ?? 0) > 0;
}

export function allowedByGroups(
  rule: AccessRule,
  groups: readonly string[]
): boolean {
  if (rule.blockedGroups?.some((group) => groups.includes(group))) {
    return false;
  }
  const required = rule.requiredGroups ?? [];
  return required.length === 0 || required.some((g) => groups.includes(g));
}

function allowedByPermissions(
  rule: AccessRule,
  subject: AccessSubject,
  byGroups: boolean
): boolean | null {
  if (!hasPermissionMapping(rule)) return byGroups;
  if (subject.permissions === null) return null;
  const held = subject.permissions;
  return rule.requiredPermissions!.some((p) => held.includes(p));
}

export function decideAccess(
  source: AccessSource,
  rule: AccessRule,
  subject: AccessSubject
): AccessDecision {
  const byGroups = allowedByGroups(rule, subject.groups);
  const byPermissions = allowedByPermissions(rule, subject, byGroups);
  const allowed = source === "permissions" ? byPermissions === true : byGroups;
  const mismatch =
    source === "shadow" && byPermissions !== null && byPermissions !== byGroups;
  return { allowed, byGroups, byPermissions, mismatch };
}

/** Names a rule in logs: its permission keys, or its groups when unmapped. */
export function describeRule(rule: AccessRule): string {
  if (hasPermissionMapping(rule)) return rule.requiredPermissions!.join("|");
  return (rule.requiredGroups ?? []).join("|") || "open";
}
