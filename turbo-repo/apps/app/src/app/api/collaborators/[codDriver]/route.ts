import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import {
  driverDetailResponseToDto,
  fetchDriverDetailByCodDriver,
} from "../../utils/pgrest-client";
import type { CollaboratorDetailDto } from "@/features/collaborators-management/types/collaborators.types";
import { logger } from "@/lib/logger";

/**
 * GET /api/collaborators/[codDriver]
 *
 * Returns the full expediente for one driver from
 * `public.api_detalle_expediente_colaborador`, mapped into
 * `CollaboratorDetailDto = { collaborator, detailData }`.
 *
 * Feature-flagged on `MIOT_COLLABORATORS_SOURCE=pgrest`. When unset the
 * route returns 501 so the detail page falls back to the mock data
 * service, mirroring the list route pattern.
 *
 * Cache: 30s fresh, 5min stale-if-error, keyed on `userId:codDriver`.
 * Same shape as `api/collaborators/route.ts`.
 */

const DETAIL_CACHE_TTL_MS = 30_000;
const DETAIL_CACHE_STALE_TTL_MS = 5 * 60_000;

type DetailCacheEntry = {
  data: CollaboratorDetailDto;
  fetchedAt: number;
  refreshPromise?: Promise<CollaboratorDetailDto>;
};

const detailCache = new Map<string, DetailCacheEntry>();

function buildCacheKey(userId: string, codDriver: string) {
  return `${userId}:${codDriver}`;
}

function buildJsonResponse(
  dto: CollaboratorDetailDto,
  cacheStatus: "MISS" | "HIT" | "STALE" | "STALE_IF_ERROR"
) {
  return NextResponse.json(dto, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Cache-Status": cacheStatus,
    },
  });
}

/**
 * Thrown inside the refresh promise when the RPC returns null (driver
 * doesn't exist upstream). Caught by the GET handler so the route can
 * distinguish 404 from 500 without polluting the cache with nulls.
 */
class DriverNotFoundError extends Error {
  constructor(codDriver: string) {
    super(`driver not found: ${codDriver}`);
    this.name = "DriverNotFoundError";
  }
}

async function fetchDetailFromPgrest(
  codDriver: string
): Promise<CollaboratorDetailDto> {
  const resp = await fetchDriverDetailByCodDriver(codDriver);
  if (!resp) throw new DriverNotFoundError(codDriver);
  return driverDetailResponseToDto(resp);
}

function refreshDetailCache(cacheKey: string, codDriver: string) {
  const existingEntry = detailCache.get(cacheKey);
  if (existingEntry?.refreshPromise) {
    return existingEntry.refreshPromise;
  }

  const refreshPromise = fetchDetailFromPgrest(codDriver)
    .then((dto) => {
      detailCache.set(cacheKey, { data: dto, fetchedAt: Date.now() });
      return dto;
    })
    .catch((error) => {
      logger.warn(
        { err: error, cacheKey },
        "Failed to refresh collaborator detail cache"
      );
      throw error;
    })
    .finally(() => {
      const currentEntry = detailCache.get(cacheKey);
      if (!currentEntry?.refreshPromise) return;
      detailCache.set(cacheKey, {
        data: currentEntry.data,
        fetchedAt: currentEntry.fetchedAt,
      });
    });

  if (existingEntry) {
    detailCache.set(cacheKey, {
      data: existingEntry.data,
      fetchedAt: existingEntry.fetchedAt,
      refreshPromise,
    });
  }

  return refreshPromise;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codDriver: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  if (process.env.MIOT_COLLABORATORS_SOURCE !== "pgrest") {
    return NextResponse.json(
      { error: "collaborators pgrest source is disabled" },
      { status: 501 }
    );
  }

  const { codDriver: rawCodDriver } = await params;
  const codDriver = decodeURIComponent(rawCodDriver ?? "").trim();
  if (!codDriver) {
    return NextResponse.json(
      { error: "codDriver path param is required" },
      { status: 400 }
    );
  }

  const userId =
    authResult.session.user?.id ??
    authResult.session.user?.email ??
    authResult.session.user?.name ??
    "anonymous";
  const cacheKey = buildCacheKey(userId, codDriver);
  const cacheEntry = detailCache.get(cacheKey);
  const now = Date.now();

  if (cacheEntry) {
    const ageMs = now - cacheEntry.fetchedAt;

    if (ageMs <= DETAIL_CACHE_TTL_MS) {
      return buildJsonResponse(cacheEntry.data, "HIT");
    }

    if (ageMs <= DETAIL_CACHE_STALE_TTL_MS) {
      void refreshDetailCache(cacheKey, codDriver).catch(() => undefined);
      return buildJsonResponse(cacheEntry.data, "STALE");
    }
  }

  try {
    const dto = await refreshDetailCache(cacheKey, codDriver);
    return buildJsonResponse(dto, "MISS");
  } catch (error) {
    if (error instanceof DriverNotFoundError) {
      return NextResponse.json({ error: "driver not found" }, { status: 404 });
    }
    if (cacheEntry) {
      return buildJsonResponse(cacheEntry.data, "STALE_IF_ERROR");
    }
    logger.error(
      { err: error, codDriver },
      "Failed to fetch collaborator detail"
    );
    return NextResponse.json(
      { error: "Failed to fetch collaborator detail" },
      { status: 500 }
    );
  }
}
