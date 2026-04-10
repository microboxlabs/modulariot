import { NextResponse } from "next/server";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import {
  fetchTruckCatalogByIdOrPlate,
  fetchTruckSignalDetailByPlate,
  signalRowToDto,
} from "../../../../utils/pgrest-client";
import { logger } from "@/lib/logger";

/**
 * Per-truck telemetry / signal detail route. Backed short-term by the
 * pgrest shortcut against `public.fn_dx_senal_detalle`. The long-term
 * replacement will come from the resource-client realtime metrics
 * pipeline — same DTO shape so only the server-side handler swaps.
 *
 * `[id]` segment accepts either a numeric `mbl_id` or a license plate.
 * Numeric ids are resolved to a plate via `fetchTruckCatalogByIdOrPlate`
 * because the function only exposes a `p_asset_id` (= plate) filter.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  if (process.env.MIOT_FLEET_SOURCE !== "pgrest") {
    return NextResponse.json(
      {
        error:
          "Truck telemetry detail is only available via the pgrest source for now",
      },
      { status: 501 }
    );
  }

  const { id: rawId } = await params;
  const idOrPlate = decodeURIComponent(rawId);
  const numericId = Number(idOrPlate);
  const isNumeric = Number.isInteger(numericId);

  try {
    let plate: string | null;
    if (isNumeric) {
      const catalogRow = await fetchTruckCatalogByIdOrPlate(String(numericId));
      plate = catalogRow?.patente ?? null;
    } else {
      plate = idOrPlate;
    }

    if (!plate) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    const row = await fetchTruckSignalDetailByPlate(plate);
    if (!row) {
      return NextResponse.json(
        { error: "Telemetry detail not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(signalRowToDto(row));
  } catch (error) {
    logger.error(
      { err: error, id: idOrPlate },
      "Failed to fetch truck telemetry detail"
    );
    return NextResponse.json(
      { error: "Failed to fetch truck telemetry detail" },
      { status: 500 }
    );
  }
}
