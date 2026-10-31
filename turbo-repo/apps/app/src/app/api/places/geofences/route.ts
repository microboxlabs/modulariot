import { NextResponse } from "next/server";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import { isCarrierOrg } from "@/app/api/utils/carrier-scope";
import { requireAuth } from "@/app/api/utils/alfresco-crud-client";
import {
  decodeEwkbOuterRing,
  fetchClientGeofences,
} from "@/app/api/utils/pgrest-client";
import { lugarDesdeGeofence } from "@/features/places/data/streamhub-geofences";
import type { Lugar } from "@/features/places/places.types";
import { logger } from "@/lib/logger";

/**
 * GET /app/api/places/geofences
 *
 * The geofences Lugares draws, read from the streamhub `geofences` table and
 * shaped like PT4 places (`Lugar[]`). Read-only: create/update/delete are not
 * wired to streamhub yet. Scoped to the app's own streamhub client
 * (`client_id` = STREAMHUB_CLIENT_ID) until orgs are mapped to client ids.
 */
export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;
  // The configured client is tower-wide, not an organization mapping.
  // A carrier must never inherit that unfiltered source.
  if (isCarrierOrg(scope.scope)) {
    return NextResponse.json(
      { error: "Organization geofence source is not configured" },
      { status: 403 }
    );
  }

  const clientId = process.env.STREAMHUB_CLIENT_ID;
  if (!clientId) {
    logger.error("STREAMHUB_CLIENT_ID is not set: no geofences to load");
    return NextResponse.json(
      { error: "Geofences source is not configured" },
      { status: 500 }
    );
  }

  try {
    const rows = await fetchClientGeofences(clientId);
    const lugares: Lugar[] = [];
    for (const row of rows) {
      const lugar = lugarDesdeGeofence(
        row,
        decodeEwkbOuterRing(row.coordinates)
      );
      if (lugar) lugares.push(lugar);
    }
    if (lugares.length < rows.length) {
      logger.warn(
        { total: rows.length, usable: lugares.length },
        "Some streamhub geofences have no usable polygon"
      );
    }
    return NextResponse.json(lugares);
  } catch (error) {
    logger.error({ err: error }, "Failed to load streamhub geofences");
    return NextResponse.json(
      { error: "Failed to load geofences" },
      { status: 500 }
    );
  }
}
