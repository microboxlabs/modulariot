import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { createResourceClient } from "../../utils/miot-resource-api-client";
import { parsePageParams, isPageParamsError } from "../../utils/page-params";
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

function buildCacheKey(request: Request, userId: string) {
  const { searchParams } = new URL(request.url);
  const normalizedParams = new URLSearchParams(searchParams);
  normalizedParams.sort();

  return `${userId}:${normalizedParams.toString()}`;
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

async function fetchTrucks(
  session: Parameters<typeof createResourceClient>[0],
  truckQuery: TruckQueryParams
) {
  const client = createResourceClient(session);
  return client.fleet.listTrucks(truckQuery);
}

function refreshFleetTrucksCache(
  cacheKey: string,
  session: Parameters<typeof createResourceClient>[0],
  truckQuery: TruckQueryParams
) {
  const existingEntry = fleetTrucksCache.get(cacheKey);
  if (existingEntry?.refreshPromise) {
    return existingEntry.refreshPromise;
  }

  const refreshPromise = fetchTrucks(session, truckQuery)
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
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

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
    authResult.session.user?.id ??
    authResult.session.user?.email ??
    authResult.session.user?.name ??
    "anonymous";
  const cacheKey = buildCacheKey(request, userId);
  const cacheEntry = fleetTrucksCache.get(cacheKey);
  const now = Date.now();

  if (cacheEntry) {
    const ageMs = now - cacheEntry.fetchedAt;

    if (ageMs <= FLEET_TRUCKS_CACHE_TTL_MS) {
      return buildJsonResponse(cacheEntry.data, "HIT");
    }

    if (ageMs <= FLEET_TRUCKS_CACHE_STALE_TTL_MS) {
      void refreshFleetTrucksCache(cacheKey, authResult.session, truckQuery).catch(
        () => undefined
      );
      return buildJsonResponse(cacheEntry.data, "STALE");
    }
  }

  try {
    const trucks = await refreshFleetTrucksCache(
      cacheKey,
      authResult.session,
      truckQuery
    );
    return buildJsonResponse(trucks, "MISS");
  } catch (error) {
    if (cacheEntry) {
      return buildJsonResponse(cacheEntry.data, "STALE_IF_ERROR");
    }

    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch trucks");
    return NextResponse.json({ error: "Failed to fetch trucks" }, { status });
  }
}
