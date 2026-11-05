/** One gate. Any one of `requiredPermissions` opens it; a rule without permissions is open. */
export interface AccessRule {
  readonly requiredPermissions?: readonly string[];
}

/**
 * Decides a gate with the caller's IAM permissions in the active organization.
 * `null` permissions (still loading, or failed to load) keep a gated rule closed.
 */
export function decideAccess(
  rule: AccessRule,
  permissions: readonly string[] | null
): boolean {
  const required = rule.requiredPermissions ?? [];
  if (required.length === 0) return true;
  if (permissions === null) return false;
  return required.some((permission) => permissions.includes(permission));
}

/** Names a rule in logs by its permission keys. */
export function describeRule(rule: AccessRule): string {
  return (rule.requiredPermissions ?? []).join("|") || "open";
}
