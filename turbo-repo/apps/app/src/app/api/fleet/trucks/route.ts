import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { createResourceClient } from "../../utils/miot-resource-api-client";
import { parsePageParams, isPageParamsError } from "../../utils/page-params";
import {
  decodeEwkbPoint,
  fetchLastPositions,
  fetchTrucksCatalog,
  getPgrestClientId,
  type PgrestMapPositionRow,
  type PgrestTruckCatalogRow,
} from "../../utils/pgrest-client";
import {
  MiotResourceApiError,
  type Tenant,
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

function mapStatus(row: PgrestTruckCatalogRow): string {
  if (!row.is_active) return "INACTIVE";
  const s = (row.status ?? "").toUpperCase();
  if (s.includes("MAINTEN")) return "MAINTENANCE";
  if (s.includes("ALERT") || s.includes("WARNING")) return "ALERT";
  return "ACTIVE";
}

function buildLatestMetricsFromPgrest(
  row: PgrestTruckCatalogRow,
  position: PgrestMapPositionRow | undefined
): Record<string, string | number | boolean | null> {
  const metrics: Record<string, string | number | boolean | null> = {};

  if (row.device_usage_qty != null) {
    metrics.odometer_km = row.device_usage_qty;
  }
  if (row.maintenance_frequency != null) {
    metrics.maintenance_frequency_km = row.maintenance_frequency;
  }
  // Human-readable city/location label from the pgrest catalog, used by the
  // fleet card instead of raw lat/lon when present.
  if (row.ubicacion && row.ubicacion.trim() !== "") {
    metrics.location_label = row.ubicacion.trim();
  }

  if (position) {
    if (position.timestamp) metrics.timestamp = position.timestamp;
    if (position.speed != null) metrics.vehicle_speed_kph = position.speed;
    if (position.heading != null) metrics.heading = position.heading;
    if (position.gps_provider != null) metrics.gps_provider = position.gps_provider;
    const point = decodeEwkbPoint(position.location);
    if (point) {
      metrics.latitude = point.latitude;
      metrics.longitude = point.longitude;
    }
  }

  return metrics;
}

/** Stubbed Tenant — pgrest does not expose tenant metadata; unused downstream. */
const PGREST_TENANT_STUB: Tenant = {
  id: 0,
  code: "pgrest",
  name: "pgrest",
  active: true,
};

function pgrestRowToTruck(
  row: PgrestTruckCatalogRow,
  position: PgrestMapPositionRow | undefined,
  clientId: string
): Truck {
  return {
    id: row.mbl_id,
    tenant: PGREST_TENANT_STUB,
    clientId,
    entityId: String(row.mbl_id),
    externalId: row.patente,
    status: mapStatus(row),
    alfrescoNodeId: "",
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    licensePlate: row.patente,
    vin: row.chassis_number ?? "",
    brand: row.brand_id ?? "",
    model: row.description ?? "",
    year: row.model_year ?? 0,
    maxWeight: 0,
    volume: 0,
    truckType: row.type_id ?? row.group_id ?? "",
    assetId: row.patente,
    latestMetrics: buildLatestMetricsFromPgrest(row, position),
  };
}

async function fetchTrucksFromPgrest(
  truckQuery: TruckQueryParams
): Promise<Truck[]> {
  const clientId = getPgrestClientId();

  const [catalog, positions] = await Promise.all([
    fetchTrucksCatalog(),
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
  truckQuery: TruckQueryParams
) {
  if (process.env.MIOT_FLEET_SOURCE === "pgrest") {
    return fetchTrucksFromPgrest(truckQuery);
  }
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
