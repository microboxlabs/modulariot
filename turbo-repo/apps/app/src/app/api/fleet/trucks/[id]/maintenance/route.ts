import { NextResponse } from "next/server";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import {
  fetchTruckCatalogByIdOrPlate,
  fetchTruckMaintenanceDetailByPlate,
  maintenanceRowToDto,
} from "../../../../utils/pgrest-client";
import { logger } from "@/lib/logger";

/**
 * Per-truck maintenance detail route. Backed short-term by the pgrest
 * shortcut against `public.fn_dx_mantenimiento_detalle`. The long-term
 * replacement is the Java endpoint described in
 * `db-scripts/plans/fleet-maintenance-state.md` §8.1 — same DTO shape on
 * both sides so only the handler swaps when that lands.
 *
 * The `[id]` segment accepts either a numeric `mbl_id` or a license plate
 * (same convention as the sibling single-truck route). Numeric ids are
 * resolved to a plate via the catalog before calling the function, since
 * the function only exposes a `p_asset_id` (= plate) filter.
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
          "Truck maintenance detail is only available via the pgrest source for now",
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

    const row = await fetchTruckMaintenanceDetailByPlate(plate);
    if (!row) {
      return NextResponse.json(
        { error: "Maintenance detail not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(maintenanceRowToDto(row));
  } catch (error) {
    logger.error(
      { err: error, id: idOrPlate },
      "Failed to fetch truck maintenance detail"
    );
    return NextResponse.json(
      { error: "Failed to fetch truck maintenance detail" },
      { status: 500 }
    );
  }
}
