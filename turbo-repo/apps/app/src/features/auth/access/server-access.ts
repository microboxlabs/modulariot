import "server-only";
import { NextResponse } from "next/server";
import { notFound, redirect } from "next/navigation";
import type { Session } from "next-auth";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { modulithHost } from "@/lib/modulith-host";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { quarkusAuthHeaders } from "@/app/api/utils/quarkus-proxy";
import { decideAccess, describeRule, type AccessRule } from "./access-control";

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
async function loadPermissions(session: Session): Promise<string[] | null> {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return null;
  const org = scope.scope.activeOrg.slug;
  const email = session.user?.email?.trim().toLowerCase();
  const cacheKey = email ? `${email}:${org}` : null;
  const cached = cacheKey ? permissionCache.get(cacheKey) : undefined;
  if (cached && cached.expiresAt > Date.now()) {
    return cached.permissions;
  }
  try {
    const permissions = await fetchPermissions(org);
    if (cacheKey) {
      permissionCache.set(cacheKey, {
        permissions,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    }
    return permissions;
  } catch (err) {
    logger.error({ err, org }, "Failed to load the caller's permissions");
    return null;
  }
}

/** Decides one gate for a session with its permissions in the active organization. */
export async function hasAccess(
  session: Session,
  rule: AccessRule
): Promise<boolean> {
  if ((rule.requiredPermissions?.length ?? 0) === 0) return true;
  return decideAccess(rule, await loadPermissions(session));
}

type PermissionResult =
  | { authorized: true; session: Session }
  | { authorized: false; response: NextResponse };

/** API route gate: 401 without a session, 403 when the gate is closed. */
export async function requirePermission(
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
  if (await hasAccess(session, rule)) {
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

/** Server page gate. Renders the not-found page when the gate is closed. */
export async function guardPage(
  rule: AccessRule,
  context: string
): Promise<void> {
  const session = await auth();
  if (!session?.user) redirect("/sign-in");
  if (await hasAccess(session, rule)) return;
  logger.warn(
    { userEmail: session.user.email, key: describeRule(rule), context },
    "Forbidden: caller lacks the required access"
  );
  notFound();
}
