import { NextResponse } from "next/server";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { createResourceClient } from "../../../../utils/miot-resource-api-client";
import {
  fetchTruckCatalogByIdOrPlate,
  fetchTruckEventsDetailByPlate,
  eventsRowsToDto,
} from "../../../../utils/pgrest-client";
import { MiotResourceApiError } from "@microboxlabs/miot-resource-client";
import { logger } from "@/lib/logger";

/**
 * Per-truck operational events route. When `MIOT_FLEET_SOURCE=pgrest`,
 * calls `public.fn_dx_eventos_detalle` via pgrest RPC. Otherwise falls
 * back to the resource client's `listTruckEvents`.
 *
 * `[id]` accepts either a numeric `mbl_id` or a license plate.
 *
 * Query params:
 *   - `minIcu` (default 2): minimum ICU severity code. 1=all, 2=skip Bajo noise.
 *   - `limit` (default 50): maximum events returned.
 */
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
  const limit = Number(searchParams.get("limit") ?? "50");
  const minIcu = Number(searchParams.get("minIcu") ?? "2");

  try {
    if (process.env.MIOT_FLEET_SOURCE === "pgrest") {
      let plate: string | null;
      if (isNumeric) {
        const catalogRow = await fetchTruckCatalogByIdOrPlate(
          String(numericId)
        );
        plate = catalogRow?.patente ?? null;
      } else {
        plate = idOrPlate;
      }

      if (!plate) {
        return NextResponse.json(
          { error: "Truck not found" },
          { status: 404 }
        );
      }

      const rows = await fetchTruckEventsDetailByPlate(plate, {
        minIcuCode: minIcu,
        limit,
      });
      return NextResponse.json(eventsRowsToDto(plate, rows));
    }

    // Non-pgrest fallback — resource client (numeric ID only).
    if (!isNumeric) {
      return NextResponse.json(
        { error: "Invalid truck ID" },
        { status: 400 }
      );
    }
    const client = createResourceClient(authResult.session);
    const events = await client.fleet.listTruckEvents(numericId, { limit });
    return NextResponse.json(events);
  } catch (error) {
    const status = error instanceof MiotResourceApiError ? error.status : 500;
    logger.error({ err: error, id: idOrPlate }, "Failed to fetch truck events");
    return NextResponse.json(
      { error: "Failed to fetch truck events" },
      { status }
    );
  }
}
