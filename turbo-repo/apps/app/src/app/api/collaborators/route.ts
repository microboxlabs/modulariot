import { NextResponse } from "next/server";
import { resolveTenantScope } from "../utils/tenant-scope";
import {
  driverRowToCollaborator,
  fetchDriversFromView,
} from "../utils/pgrest-client";
import type { Collaborator } from "@/features/collaborators-management/types/collaborators.types";
import { logger } from "@/lib/logger";

/**
 * GET /api/collaborators
 *
 * Returns the list of drivers from `public.v_modulariot_drivers_tmp`, mapped
 * into the existing `Collaborator` shape. Supports `?q=<search>` for a
 * case-insensitive OR match across `name_driver`, `cust_account`, and
 * `cod_driver` — see plan file for the caveats about the missing driver
 * RUT column.
 *
 * Feature-flagged on `MIOT_COLLABORATORS_SOURCE=pgrest`. When the flag is
 * unset the route returns 501 so the page falls back to mock data.
 *
 * Cache: 30s fresh, 5min stale-if-error, mirroring the fleet trucks route
 * pattern. The backing view is effectively static today so staleness is
 * not a concern.
 */

const COLLABORATORS_CACHE_TTL_MS = 30_000;
const COLLABORATORS_CACHE_STALE_TTL_MS = 5 * 60_000;

type CollaboratorsCacheEntry = {
  data: Collaborator[];
  fetchedAt: number;
  refreshPromise?: Promise<Collaborator[]>;
};

const collaboratorsCache = new Map<string, CollaboratorsCacheEntry>();

// Sweep the entire cache when it exceeds this size, removing entries whose
// stale window has expired. Triggered on writes so growth is bounded without
// needing a setInterval (which can duplicate across Next.js HMR reloads).
const CACHE_PRUNE_THRESHOLD = 200;

function pruneCollaboratorsCache() {
  if (collaboratorsCache.size < CACHE_PRUNE_THRESHOLD) return;
  const cutoff = Date.now() - COLLABORATORS_CACHE_STALE_TTL_MS;
  for (const [key, entry] of collaboratorsCache) {
    if (!entry.refreshPromise && entry.fetchedAt < cutoff) {
      collaboratorsCache.delete(key);
    }
  }
}

function buildCacheKey(userId: string, activeOrgSlug: string, query: string) {
  return `${userId}:${activeOrgSlug}:${query}`;
}

function buildJsonResponse(
  collaborators: Collaborator[],
  cacheStatus: "MISS" | "HIT" | "STALE" | "STALE_IF_ERROR"
) {
  return NextResponse.json(collaborators, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Cache-Status": cacheStatus,
    },
  });
}

async function fetchCollaboratorsFromPgrest(
  query: string | null,
  custAccounts?: string[],
): Promise<Collaborator[]> {
  const rows = await fetchDriversFromView({
    q: query ?? undefined,
    custAccounts,
  });
  return rows.map(driverRowToCollaborator);
}

function refreshCollaboratorsCache(
  cacheKey: string,
  query: string | null,
  custAccounts?: string[],
) {
  const existingEntry = collaboratorsCache.get(cacheKey);
  if (existingEntry?.refreshPromise) {
    return existingEntry.refreshPromise;
  }

  const refreshPromise = fetchCollaboratorsFromPgrest(query, custAccounts)
    .then((collaborators) => {
      pruneCollaboratorsCache();
      collaboratorsCache.set(cacheKey, {
        data: collaborators,
        fetchedAt: Date.now(),
      });
      return collaborators;
    })
    .catch((error) => {
      logger.warn(
        { err: error, cacheKey },
        "Failed to refresh collaborators cache"
      );
      throw error;
    })
    .finally(() => {
      const currentEntry = collaboratorsCache.get(cacheKey);
      if (!currentEntry?.refreshPromise) return;
      collaboratorsCache.set(cacheKey, {
        data: currentEntry.data,
        fetchedAt: currentEntry.fetchedAt,
      });
    });

  collaboratorsCache.set(cacheKey, {
    data: existingEntry?.data ?? [],
    fetchedAt: existingEntry?.fetchedAt ?? 0,
    refreshPromise,
  });

  return refreshPromise;
}

export async function GET(request: Request) {
  // Resolve tenant scope — replaces the old requireAuth() call.
  // When effectiveTaxIds is non-empty the pgrest query is filtered by cust_account;
  // when empty (e.g. new parent org with no children, or no tax ids populated yet)
  // the query runs unfiltered (graceful degradation for Phase 1 deployments).
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  const { scope } = scopeResult;

  if (process.env.MIOT_COLLABORATORS_SOURCE !== "pgrest") {
    return NextResponse.json(
      { error: "collaborators pgrest source is disabled" },
      { status: 501 }
    );
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get("q");
  const query = rawQuery && rawQuery.trim().length > 0 ? rawQuery.trim() : null;

  const userId =
    scopeResult.session.user?.id ??
    scopeResult.session.user?.email ??
    scopeResult.session.user?.name ??
    "anonymous";
  const cacheKey = buildCacheKey(userId, scope.activeOrg.slug, query ?? "");
  const cacheEntry = collaboratorsCache.get(cacheKey);
  const now = Date.now();
  const custAccounts =
    scope.effectiveTaxIds.length > 0 ? scope.effectiveTaxIds : undefined;

  if (cacheEntry) {
    const ageMs = now - cacheEntry.fetchedAt;

    if (ageMs <= COLLABORATORS_CACHE_TTL_MS) {
      return buildJsonResponse(cacheEntry.data, "HIT");
    }

    if (ageMs <= COLLABORATORS_CACHE_STALE_TTL_MS) {
      void refreshCollaboratorsCache(cacheKey, query, custAccounts).catch(
        () => undefined,
      );
      return buildJsonResponse(cacheEntry.data, "STALE");
    }

    // Entry is older than the stale TTL — evict it so memory doesn't stay
    // resident until the next threshold-based sweep.
    collaboratorsCache.delete(cacheKey);
  }

  try {
    const collaborators = await refreshCollaboratorsCache(
      cacheKey,
      query,
      custAccounts,
    );
    return buildJsonResponse(collaborators, "MISS");
  } catch (error) {
    if (cacheEntry) {
      return buildJsonResponse(cacheEntry.data, "STALE_IF_ERROR");
    }
    logger.error({ err: error }, "Failed to fetch collaborators");
    return NextResponse.json(
      { error: "Failed to fetch collaborators" },
      { status: 500 }
    );
  }
}
