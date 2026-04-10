import { NextResponse } from "next/server";
import { resolveTenantScope } from "../../utils/tenant-scope";
import { createResourceClient } from "../../utils/miot-resource-api-client";
import { parsePageParams, isPageParamsError } from "../../utils/page-params";
import {
  fetchLastPositions,
  fetchTrucksCatalog,
  getPgrestClientId,
  pgrestRowToTruck,
  type PgrestMapPositionRow,
} from "../../utils/pgrest-client";
import {
  MiotResourceApiError,
  type Truck,
  type TruckMetricView,
  type TruckQueryParams,
} from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

const FLEET_TRUCKS_CACHE_TTL_MS = 30_000;
const FLEET_TRUCKS_CACHE_STALE_TTL_MS = 5 * 60_000;

type FleetTrucksCacheEntry = {
  data: Truck[];
  fetchedAt: number;
  refreshPromise?: Promise<Truck[]>;
};

const fleetTrucksCache = new Map<string, FleetTrucksCacheEntry>();

function buildCacheKey(request: Request, userId: string, activeOrgSlug: string) {
  const { searchParams } = new URL(request.url);
  const normalizedParams = new URLSearchParams(searchParams);
  normalizedParams.sort();

  return `${userId}:${activeOrgSlug}:${normalizedParams.toString()}`;
}

function buildJsonResponse(
  trucks: Truck[],
  cacheStatus: "MISS" | "HIT" | "STALE" | "STALE_IF_ERROR"
) {
  return NextResponse.json(trucks, {
    headers: {
      "Cache-Control": "private, no-store",
      "X-Cache-Status": cacheStatus,
    },
  });
}

async function fetchTrucksFromPgrest(
  truckQuery: TruckQueryParams,
  custAccounts?: string[],
): Promise<Truck[]> {
  const clientId = getPgrestClientId();

  const [catalog, positions] = await Promise.all([
    fetchTrucksCatalog({ custAccounts }),
    fetchLastPositions(clientId),
  ]);

  const positionByAsset = new Map<string, PgrestMapPositionRow>();
  for (const p of positions) {
    if (p.asset_id) positionByAsset.set(p.asset_id, p);
  }

  const all = catalog.map((row) =>
    pgrestRowToTruck(row, positionByAsset.get(row.patente), clientId)
  );

  // Client-side pagination: the frontend currently passes size=9999 so this
  // is effectively a no-op, but respects the contract.
  const page = truckQuery.page ?? 0;
  const size = truckQuery.size ?? all.length;
  const start = page * size;
  return all.slice(start, start + size);
}

async function fetchTrucks(
  session: Parameters<typeof createResourceClient>[0],
  truckQuery: TruckQueryParams,
  custAccounts?: string[],
) {
  if (process.env.MIOT_FLEET_SOURCE === "pgrest") {
    return fetchTrucksFromPgrest(truckQuery, custAccounts);
  }
  const client = createResourceClient(session);
  return client.fleet.listTrucks(truckQuery);
}

function refreshFleetTrucksCache(
  cacheKey: string,
  session: Parameters<typeof createResourceClient>[0],
  truckQuery: TruckQueryParams,
  custAccounts?: string[],
) {
  const existingEntry = fleetTrucksCache.get(cacheKey);
  if (existingEntry?.refreshPromise) {
    return existingEntry.refreshPromise;
  }

  const refreshPromise = fetchTrucks(session, truckQuery, custAccounts)
    .then((trucks) => {
      fleetTrucksCache.set(cacheKey, {
        data: trucks,
        fetchedAt: Date.now(),
      });
      return trucks;
    })
    .catch((error) => {
      logger.warn({ err: error, cacheKey }, "Failed to refresh fleet trucks cache");
      throw error;
    })
    .finally(() => {
      const currentEntry = fleetTrucksCache.get(cacheKey);
      if (!currentEntry?.refreshPromise) return;

      fleetTrucksCache.set(cacheKey, {
        data: currentEntry.data,
        fetchedAt: currentEntry.fetchedAt,
      });
    });

  fleetTrucksCache.set(cacheKey, {
    data: existingEntry?.data ?? [],
    fetchedAt: existingEntry?.fetchedAt ?? 0,
    refreshPromise,
  });

  return refreshPromise;
}

export async function GET(request: Request) {
  const scopeResult = await resolveTenantScope();
  if (!scopeResult.resolved) return scopeResult.response;
  const { scope, session } = scopeResult;

  const { searchParams } = new URL(request.url);
  const pageParams = parsePageParams(searchParams);
  if (isPageParamsError(pageParams)) return pageParams.error;
  const { page, size } = pageParams;
  const includeMetrics = searchParams.get("includeMetrics");
  const metricView = searchParams.get("metricView");
  const metricFields = searchParams.get("metricFields");

  const truckQuery: TruckQueryParams = { page, size };
  if (includeMetrics !== null) {
    truckQuery.includeMetrics = includeMetrics === "true";
  }
  if (metricView) {
    truckQuery.metricView = metricView as TruckMetricView;
  }
  if (metricFields) {
    truckQuery.metricFields = metricFields;
  }

  const userId =
    session.user?.id ??
    session.user?.email ??
    session.user?.name ??
    "anonymous";
  const cacheKey = buildCacheKey(request, userId, scope.activeOrg.slug);
  const cacheEntry = fleetTrucksCache.get(cacheKey);
  const now = Date.now();
  const custAccounts =
    scope.effectiveTaxIds.length > 0 ? scope.effectiveTaxIds : undefined;

  if (cacheEntry) {
    const ageMs = now - cacheEntry.fetchedAt;

    if (ageMs <= FLEET_TRUCKS_CACHE_TTL_MS) {
      return buildJsonResponse(cacheEntry.data, "HIT");
    }

    if (ageMs <= FLEET_TRUCKS_CACHE_STALE_TTL_MS) {
      void refreshFleetTrucksCache(
        cacheKey,
        session,
        truckQuery,
        custAccounts,
      ).catch(() => undefined);
      return buildJsonResponse(cacheEntry.data, "STALE");
    }
  }

  // Entry is either absent or older than the stale TTL — evict it so stale
  // data doesn't stay resident and attempt a fresh fetch.
  if (cacheEntry) {
    fleetTrucksCache.delete(cacheKey);
  }

  try {
    const trucks = await refreshFleetTrucksCache(
      cacheKey,
      session,
      truckQuery,
      custAccounts,
    );
    return buildJsonResponse(trucks, "MISS");
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch trucks");
    return NextResponse.json({ error: "Failed to fetch trucks" }, { status });
  }
}
