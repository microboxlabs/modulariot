import { NextResponse } from "next/server";
import { requireAuth } from "../utils/alfresco-crud-client";
import {
  driverRowToColaborator,
  fetchDriversFromView,
} from "../utils/pgrest-client";
import type { Colaborator } from "@/features/colaborators-management/types/colaborators.types";
import { logger } from "@/lib/logger";

/**
 * GET /api/collaborators
 *
 * Returns the list of drivers from `public.v_modulariot_drivers_tmp`, mapped
 * into the existing `Colaborator` shape. Supports `?q=<search>` for a
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
  data: Colaborator[];
  fetchedAt: number;
  refreshPromise?: Promise<Colaborator[]>;
};

const collaboratorsCache = new Map<string, CollaboratorsCacheEntry>();

function buildCacheKey(userId: string, query: string) {
  return `${userId}:${query}`;
}

function buildJsonResponse(
  colaborators: Colaborator[],
  cacheStatus: "MISS" | "HIT" | "STALE" | "STALE_IF_ERROR"
) {
  return NextResponse.json(colaborators, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Cache-Status": cacheStatus,
    },
  });
}

async function fetchCollaboratorsFromPgrest(
  query: string | null
): Promise<Colaborator[]> {
  const rows = await fetchDriversFromView(
    query ? { q: query } : undefined
  );
  return rows.map(driverRowToColaborator);
}

function refreshCollaboratorsCache(cacheKey: string, query: string | null) {
  const existingEntry = collaboratorsCache.get(cacheKey);
  if (existingEntry?.refreshPromise) {
    return existingEntry.refreshPromise;
  }

  const refreshPromise = fetchCollaboratorsFromPgrest(query)
    .then((colaborators) => {
      collaboratorsCache.set(cacheKey, {
        data: colaborators,
        fetchedAt: Date.now(),
      });
      return colaborators;
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
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

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
    authResult.session.user?.id ??
    authResult.session.user?.email ??
    authResult.session.user?.name ??
    "anonymous";
  const cacheKey = buildCacheKey(userId, query ?? "");
  const cacheEntry = collaboratorsCache.get(cacheKey);
  const now = Date.now();

  if (cacheEntry) {
    const ageMs = now - cacheEntry.fetchedAt;

    if (ageMs <= COLLABORATORS_CACHE_TTL_MS) {
      return buildJsonResponse(cacheEntry.data, "HIT");
    }

    if (ageMs <= COLLABORATORS_CACHE_STALE_TTL_MS) {
      void refreshCollaboratorsCache(cacheKey, query).catch(() => undefined);
      return buildJsonResponse(cacheEntry.data, "STALE");
    }
  }

  try {
    const colaborators = await refreshCollaboratorsCache(cacheKey, query);
    return buildJsonResponse(colaborators, "MISS");
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
