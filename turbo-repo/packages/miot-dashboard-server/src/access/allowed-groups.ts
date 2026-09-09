/**
 * The `allowedGroups` rule, as a capability policy.
 *
 * Some hosts keep a dashboard's audience inside the config itself: a list of
 * groups, and only members of one of them may see it. That is not a rule this
 * package invents — it is one an existing app already enforces, and it has to
 * keep working unchanged when those routes move onto this package. Expressing
 * it as a `CapabilityPolicy` is what lets that happen without the rule leaking
 * into the access control.
 *
 * It only ever takes access away. The gate runs first and denies outright;
 * everything it allows is decided by the policy underneath, and the access
 * control still intersects that with the principal's own ceiling.
 */

import type { DashboardCapabilities } from "../seams/identity";
import {
  roleCapabilityPolicy,
  type CapabilityContext,
  type CapabilityPolicy,
} from "./capabilities";

/** Where the audience list sits in a stored config. */
export const ALLOWED_GROUPS_FIELD = "allowedGroups";

type ParsedAudience =
  | { valid: true; groups: readonly string[] | undefined }
  | { valid: false };

/**
 * Absent means "no restriction"; a present but malformed value means the
 * dashboard's audience cannot be determined.
 *
 * Malformed denies rather than falls back to open. A list that failed to
 * parse is the case where something wrote a shape nobody expected, and
 * guessing "no restriction" there publishes a dashboard that was meant to be
 * restricted — the failure that cannot be noticed by looking at it.
 */
export function parseAllowedGroups(value: unknown): ParsedAudience {
  if (value === undefined || value === null) {
    return { valid: true, groups: undefined };
  }
  if (!Array.isArray(value)) return { valid: false };
  if (!value.every((group): group is string => typeof group === "string")) {
    return { valid: false };
  }
  return { valid: true, groups: value };
}

/** `allowedGroups` off a stored config, without trusting it to be an object. */
function audienceOf(config: unknown): unknown {
  if (typeof config !== "object" || config === null) return undefined;
  return (config as Record<string, unknown>)[ALLOWED_GROUPS_FIELD];
}

/**
 * Wrap a policy so a dashboard naming an audience is visible only to it.
 *
 * A dashboard that does not exist yet has no audience to enforce, so a first
 * save is left to the policy underneath.
 */
export function createAllowedGroupsPolicy(
  inner: CapabilityPolicy = roleCapabilityPolicy,
): CapabilityPolicy {
  return {
    resolve(
      context: CapabilityContext,
    ): DashboardCapabilities | null | Promise<DashboardCapabilities | null> {
      if (context.record === null) return inner.resolve(context);

      const audience = parseAllowedGroups(audienceOf(context.record.config));
      if (!audience.valid) return null;
      if (audience.groups === undefined || audience.groups.length === 0) {
        return inner.resolve(context);
      }

      const held = new Set(context.identity.groups ?? []);
      const inAudience = audience.groups.some((group) => held.has(group));
      return inAudience ? inner.resolve(context) : null;
    },
  };
}
