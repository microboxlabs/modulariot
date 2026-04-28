import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { resolveTenantScope } from "../../utils/tenant-scope";
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
};

const detailCache = new Map<string, DetailCacheEntry>();
const inFlight = new Map<string, Promise<CollaboratorDetailDto>>();

/** Returns a non-PII user token: the raw id when available, otherwise a SHA-256 prefix of the fallback value. */
function resolveUserToken(user: { id?: string | null; email?: string | null; name?: string | null } | undefined): string {
  if (user?.id) return user.id;
  const raw = user?.email ?? user?.name;
  if (!raw) return "anon";
  return createHash("sha256").update(raw).digest("hex").slice(0, 16);
}

function buildCacheKey(userToken: string, activeOrgSlug: string, codDriver: string) {
  return `${userToken}:${activeOrgSlug}:${codDriver}`;
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
  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const promise = fetchDetailFromPgrest(codDriver)
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
      inFlight.delete(cacheKey);
    });

  inFlight.set(cacheKey, promise);
  return promise;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ codDriver: string }> }
) {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  const { scope, session } = scopeResult;

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

  const userToken = resolveUserToken(session.user);
  const cacheKey = buildCacheKey(userToken, scope.activeOrg.slug, codDriver);
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

    // Enforce scope: if the active org has tax ids configured, the returned
    // driver's cust_account (mapped to `department`) must be in the set.
    if (
      scope.effectiveTaxIds.length > 0 &&
      dto.collaborator.department &&
      !scope.effectiveTaxIds.includes(dto.collaborator.department)
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return buildJsonResponse(dto, "MISS");
  } catch (error) {
    if (error instanceof DriverNotFoundError) {
      return NextResponse.json({ error: "driver not found" }, { status: 404 });
    }
    if (cacheEntry) {
      const ageMs = now - cacheEntry.fetchedAt;
      if (ageMs <= DETAIL_CACHE_STALE_TTL_MS) {
        return buildJsonResponse(cacheEntry.data, "STALE_IF_ERROR");
      }
      detailCache.delete(cacheKey);
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
