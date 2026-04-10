import { NextResponse } from "next/server";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { createResourceClient } from "../../../utils/miot-resource-api-client";
import {
  fetchLastPositions,
  fetchTruckCatalogByIdOrPlate,
  getPgrestClientId,
  pgrestRowToTruck,
} from "../../../utils/pgrest-client";
import {
  MiotResourceApiError,
  type Truck,
  type TruckMetricView,
} from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

/**
 * Fetch a single truck from the pgrest source by either `mbl_id` or license
 * plate. Returns `null` when not found. Loads the last-position snapshot in
 * parallel with the catalog row and filters it in memory because the
 * `api_modular_map_positions` RPC has no single-asset variant.
 */
async function fetchTruckFromPgrest(idOrPlate: string): Promise<Truck | null> {
  const clientId = getPgrestClientId();

  const [row, positions] = await Promise.all([
    fetchTruckCatalogByIdOrPlate(idOrPlate),
    fetchLastPositions(clientId),
  ]);

  if (!row) return null;

  const position = positions.find((p) => p.asset_id === row.patente);
  return pgrestRowToTruck(row, position, clientId);
}

/**
 * Non-pgrest fallback when the caller passes a plate rather than a numeric
 * id. The resource client exposes `getTruck(numericId)` but not a by-plate
 * lookup, so fall back to paging through `listTrucks` and filtering. This is
 * wasteful but consistent with how the list view already loads data today —
 * revisit when a dedicated endpoint exists.
 */
async function findTruckByPlate(
  session: Parameters<typeof createResourceClient>[0],
  plate: string,
  includeMetrics: boolean | undefined,
  metricView: TruckMetricView | undefined,
  metricFields: string | undefined
): Promise<Truck | null> {
  const client = createResourceClient(session);
  const trucks = await client.fleet.listTrucks({
    page: 0,
    size: 9999,
    includeMetrics,
    metricView,
    metricFields,
  });
  return trucks.find((t) => t.licensePlate === plate) ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { id: rawId } = await params;
  const idOrPlate = decodeURIComponent(rawId);
  const numericId = Number(idOrPlate);
  const isNumeric = Number.isInteger(numericId);

  const { searchParams } = new URL(request.url);
  const includeMetricsParam = searchParams.get("includeMetrics");
  const metricViewParam = searchParams.get("metricView");
  const metricFieldsParam = searchParams.get("metricFields");
  const includeMetrics =
    includeMetricsParam === null ? undefined : includeMetricsParam === "true";
  const metricView = metricViewParam
    ? (metricViewParam as TruckMetricView)
    : undefined;
  const metricFields = metricFieldsParam ?? undefined;

  try {
    let truck: Truck | null;
    if (process.env.MIOT_FLEET_SOURCE === "pgrest") {
      truck = await fetchTruckFromPgrest(idOrPlate);
    } else if (isNumeric) {
      const client = createResourceClient(authResult.session);
      truck = await client.fleet.getTruck(numericId, {
        includeMetrics,
        metricView,
        metricFields,
      });
    } else {
      truck = await findTruckByPlate(
        authResult.session,
        idOrPlate,
        includeMetrics,
        metricView,
        metricFields
      );
    }

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }
    return NextResponse.json(truck);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error, id: idOrPlate }, "Failed to fetch truck");
    return NextResponse.json({ error: "Failed to fetch truck" }, { status });
  }
}
