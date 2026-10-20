import "server-only";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { modulithHost } from "@/lib/modulith-host";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { quarkusAuthHeaders } from "@/app/api/utils/quarkus-proxy";
import { getGroupsForPerson } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { PLATFORM_OWNER_ROLE } from "@/features/settings-admin/platform/platform.types";
import {
  decideAccess,
  describeRule,
  needsGroups,
  needsPermissions,
  parseAccessSource,
  type AccessDecision,
  type AccessRule,
  type AccessSource,
} from "./access-control";

export function accessSource(): AccessSource {
  return parseAccessSource(process.env.ACCESS_CONTROL_SOURCE);
}

interface OrgPermissions {
  readonly org: string | null;
  readonly permissions: string[] | null;
}

const CACHE_TTL_MS = 30_000;
const permissionCache = new Map<
  string,
  { permissions: string[]; expiresAt: number }
>();

async function fetchPermissions(org: string): Promise<string[]> {
  const headers = await quarkusAuthHeaders();
  if (!headers) throw new Error("No session");
  const res = await fetch(
    `${modulithHost()}/api/v1/orgs/${encodeURIComponent(org)}/me/access`,
    { headers, signal: AbortSignal.timeout(10_000) }
  );
  if (!res.ok) throw new Error(`GET me/access → ${res.status}`);
  const body = (await res.json()) as { permissions?: string[] };
  return body.permissions ?? [];
}

/** The caller's permissions in the active organization; `null` when they cannot be loaded. */
async function loadPermissions(session: Session): Promise<OrgPermissions> {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return { org: null, permissions: null };
  const org = scope.scope.activeOrg.slug;
  const email = session.user?.email?.trim().toLowerCase();
  const cacheKey = email ? `${email}:${org}` : null;
  const cached = cacheKey ? permissionCache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return { org, permissions: cached.permissions };
  }
  try {
    const permissions = await fetchPermissions(org);
    if (cacheKey) {
      permissionCache.set(cacheKey, {
        permissions,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }
    return { org, permissions };
  } catch (err) {
    logger.error({ err, org }, "Failed to load the caller's permissions");
    return { org, permissions: null };
  }
}

async function loadGroups(session: Session): Promise<string[]> {
  try {
    return await getGroupsForPerson(session);
  } catch (err) {
    logger.error({ err }, "Failed to load the caller's groups");
    return [];
  }
}

/** Logs a shadow-mode disagreement between the groups and the permissions. */
export function logAccessMismatch(
  fields: {
    userEmail: string | null | undefined;
    org: string | null;
    key: string;
    context?: string;
  },
  decision: Pick<AccessDecision, "byGroups" | "byPermissions">
): void {
  logger.warn(
    {
      ...fields,
      byGroups: decision.byGroups,
      byPermissions: decision.byPermissions,
    },
    "Access mismatch between groups and permissions"
  );
}

/** Decides one gate for a session with the configured access source. */
export async function hasAccess(
  session: Session,
  rule: AccessRule,
  context?: string
): Promise<boolean> {
  const source = accessSource();
  const [groups, orgPermissions] = await Promise.all([
    needsGroups(source, rule) ? loadGroups(session) : Promise.resolve([]),
    needsPermissions(source, rule)
      ? loadPermissions(session)
      : Promise.resolve<OrgPermissions>({ org: null, permissions: null }),
  ]);
  const decision = decideAccess(source, rule, {
    groups,
    permissions: orgPermissions.permissions,
  });
  if (decision.mismatch) {
    logAccessMismatch(
      {
        userEmail: session.user?.email,
        org: orgPermissions.org,
        key: describeRule(rule),
        context,
      },
      decision
    );
  }
  return decision.allowed;
}

/** Whether the caller holds `PLATFORM_OWNER`; false when the modulith cannot be read. */
export async function isPlatformOwner(): Promise<boolean> {
  try {
    const headers = await quarkusAuthHeaders();
    if (!headers) return false;
    const res = await fetch(`${modulithHost()}/api/v1/platform/roles/me`, {
      headers,
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`GET platform/roles/me → ${res.status}`);
    const body = (await res.json()) as { roleCodes?: unknown };
    return (
      Array.isArray(body.roleCodes) &&
      body.roleCodes.includes(PLATFORM_OWNER_ROLE)
    );
  } catch (err) {
    logger.error({ err }, "Failed to load the caller's platform roles");
    return false;
  }
}

/**
 * Gate for operations that affect the whole deployment, not one organization.
 * In `permissions` mode only a platform owner passes; in `groups` and
 * `shadow` modes `rule` decides.
 */
async function hasPlatformAccess(
  session: Session,
  rule: AccessRule,
  context?: string
): Promise<boolean> {
  if (accessSource() === "permissions") return isPlatformOwner();
  return hasAccess(session, rule, context);
}

type PermissionResult =
  | { authorized: true; session: Session }
  | { authorized: false; response: NextResponse };

/** API route gate: 401 without a session, 403 when the gate is closed. */
export async function requirePermission(
  rule: AccessRule,
  context?: string
): Promise<PermissionResult> {
  return authorize(hasAccess, rule, context);
}

/** API route gate for deployment-wide operations; see `hasPlatformAccess`. */
export async function requirePlatformAccess(
  rule: AccessRule,
  context?: string
): Promise<PermissionResult> {
  return authorize(hasPlatformAccess, rule, context);
}

async function authorize(
  decide: (session: Session, rule: AccessRule, context?: string) => Promise<boolean>,
  rule: AccessRule,
  context?: string
): Promise<PermissionResult> {
  const session = await auth();
  if (!session?.user) {
    return {
      authorized: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (await decide(session, rule, context)) {
    return { authorized: true, session };
  }
  logger.warn(
    { userEmail: session.user.email, key: describeRule(rule), context },
    "Forbidden: caller lacks the required access"
  );
  return {
    authorized: false,
    response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
  };
}

/**
 * Server page gate. Renders the not-found page when the gate is closed. In
 * `groups` and `shadow` modes it leaves the page to the client RouteGuard,
 * unless `always` is set for pages that were already checked on the server.
 */
export async function guardPage(
  rule: AccessRule,
  context: string,
  options: { always?: boolean } = {}
): Promise<void> {
  if (accessSource() !== "permissions" && !options.always) return;
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!(await hasAccess(session, rule, context))) notFound();
}

/** Server page gate for deployment-wide pages; see `hasPlatformAccess`. */
export async function guardPlatformPage(
  rule: AccessRule,
  context: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (!(await hasPlatformAccess(session, rule, context))) notFound();
}
