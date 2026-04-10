import "server-only";
import { auth } from "@/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape returned by Quarkus GET /api/v1/me/scopes */
interface OrganizationScope {
  organizationId: number;
  slug: string;
  displayName: string;
  taxId: string | null;
  role: string;
  isParent: boolean;
  effectiveTaxIds: string[];
  modules: string[];
}

export interface TenantScope {
  activeOrg: {
    id: number;
    slug: string;
    displayName: string;
    taxId: string | null;
    role: string;
    isParent: boolean;
    modules: string[];
  };
  availableOrgs: Array<{
    id: number;
    slug: string;
    displayName: string;
    taxId: string | null;
    isParent: boolean;
  }>;
  /** Tax ids for the active org (union of children for parents). */
  effectiveTaxIds: string[];
}

export type TenantScopeResult =
  | { resolved: true; scope: TenantScope; session: Session }
  | { resolved: false; response: NextResponse };

// ---------------------------------------------------------------------------
// Cache (in-process, short TTL — avoids hammering Quarkus on every request)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 60_000; // 60 s
const scopeCache = new Map<
  string,
  { scopes: OrganizationScope[]; expiresAt: number }
>();

function getCached(userId: string): OrganizationScope[] | null {
  const entry = scopeCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) return entry.scopes;
  if (entry) scopeCache.delete(userId);
  return null;
}

function setCache(userId: string, scopes: OrganizationScope[]): void {
  scopeCache.set(userId, { scopes, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Evict the cache for a user (call when the active org switches). */
export function evictScopeCache(userId: string): void {
  scopeCache.delete(userId);
}

// ---------------------------------------------------------------------------
// Core resolver
// ---------------------------------------------------------------------------

const ACTIVE_ORG_COOKIE = "miot_active_org";

/**
 * Resolves the caller's multi-tenant scope by calling the Quarkus backend
 * and selecting the active organization from the {@code miot_active_org}
 * cookie (falls back to the first org if the cookie is absent or invalid).
 *
 * Use in route handlers the same way you'd use {@code requireAuth()}:
 *
 * ```ts
 * const result = await resolveTenantScope();
 * if (!result.resolved) return result.response;
 * const { scope, session } = result;
 * ```
 */
export async function resolveTenantScope(): Promise<TenantScopeResult> {
  const session = await auth();
  if (!session?.user?.id) {
    return {
      resolved: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  let scopes: OrganizationScope[];
  try {
    scopes = await fetchScopes(session);
  } catch (err) {
    logger.error({ err }, "Failed to resolve tenant scopes");
    return {
      resolved: false,
      response: NextResponse.json(
        { error: "Failed to resolve tenant scopes" },
        { status: 502 },
      ),
    };
  }

  if (!scopes.length) {
    return {
      resolved: false,
      response: NextResponse.json(
        { error: "No organization memberships found" },
        { status: 403 },
      ),
    };
  }

  // Pick the active org from the cookie, or default to the first scope.
  const cookieStore = await cookies();
  const activeSlug = cookieStore.get(ACTIVE_ORG_COOKIE)?.value;
  const activeScope =
    (activeSlug ? scopes.find((s) => s.slug === activeSlug) : null) ??
    scopes[0];

  return {
    resolved: true,
    scope: {
      activeOrg: {
        id: activeScope.organizationId,
        slug: activeScope.slug,
        displayName: activeScope.displayName,
        taxId: activeScope.taxId,
        role: activeScope.role,
        isParent: activeScope.isParent,
        modules: activeScope.modules,
      },
      availableOrgs: scopes.map((s) => ({
        id: s.organizationId,
        slug: s.slug,
        displayName: s.displayName,
        taxId: s.taxId,
        isParent: s.isParent,
      })),
      effectiveTaxIds: activeScope.effectiveTaxIds,
    },
    session,
  };
}

// ---------------------------------------------------------------------------
// Module guard
// ---------------------------------------------------------------------------

/**
 * Returns a 403 NextResponse if the active org lacks the given module.
 * Returns {@code null} when access is granted.
 */
export function requireModule(
  scope: TenantScope,
  code: string,
): NextResponse | null {
  if (scope.activeOrg.modules.includes(code)) return null;
  return NextResponse.json(
    {
      error: `Module ${code} is not enabled for organization ${scope.activeOrg.slug}`,
    },
    { status: 403 },
  );
}

// ---------------------------------------------------------------------------
// Quarkus fetch
// ---------------------------------------------------------------------------

async function fetchScopes(session: Session): Promise<OrganizationScope[]> {
  const userId = session.user!.id;

  const cached = getCached(userId);
  if (cached) return cached;

  const baseUrl = process.env.MIOT_RESOURCE_URL;
  if (!baseUrl) {
    throw new Error(
      "MIOT_RESOURCE_URL environment variable is not set. " +
        "Required for tenant scope resolution.",
    );
  }

  const token = session.user?.rawJWT ?? session.user?.ticket;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  // Dev fallback: when auth is via Alfresco ticket (no JWT), forward email
  // so the Quarkus MeResource can resolve the caller (same pattern as
  // OrganizationRequestFilter's X-Dev-User-Email header).
  if (!session.user?.rawJWT && session.user?.email) {
    headers["X-Dev-User-Email"] = session.user.email;
  }

  const res = await fetch(`${baseUrl}/api/v1/me/scopes`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`GET /api/v1/me/scopes → ${res.status}: ${body}`);
  }

  const scopes: OrganizationScope[] = await res.json();
  setCache(userId, scopes);
  return scopes;
}
