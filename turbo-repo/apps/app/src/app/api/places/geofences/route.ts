import { NextResponse } from "next/server";
import { z } from "zod";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import {
  geocercaModulithSchema,
  lugarDesdeGeofence,
} from "@/features/places/data/streamhub-geofences";
import type { Lugar } from "@/features/places/places.types";
import { logger } from "@/lib/logger";

/** The most geofences miot-places serves in one page. */
const MAX_GEOCERCAS = 2000;

const geocercasSchema = z.array(geocercaModulithSchema);

/**
 * GET /app/api/places/geofences
 *
 * The geofences Lugares draws, read from the streamhub `geofences` table
 * through the modulith (miot-places) and shaped like PT4 places (`Lugar[]`).
 * The modulith scopes them to the caller's active organization (its tenant
 * code is the streamhub client id). Read-only: create/update/delete are not
 * wired yet.
 */
export async function GET() {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;

  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  const upstream = await forwardToQuarkus(
    `/api/v1/orgs/${org}/places/geofences?size=${MAX_GEOCERCAS}`
  );
  if (!upstream.ok) return upstream;

  const parsed = geocercasSchema.safeParse(
    await upstream.json().catch(() => null)
  );
  if (!parsed.success) {
    logger.error(
      { err: parsed.error },
      "miot-places answered geofences in an unexpected shape"
    );
    return NextResponse.json(
      { error: "Failed to load geofences" },
      { status: 502 }
    );
  }

  const geocercas = parsed.data;
  const lugares: Lugar[] = [];
  for (const geocerca of geocercas) {
    const lugar = lugarDesdeGeofence(geocerca);
    if (lugar) lugares.push(lugar);
  }
  if (lugares.length < geocercas.length) {
    logger.warn(
      { total: geocercas.length, usable: lugares.length },
      "Some streamhub geofences have no usable polygon"
    );
  }
  if (geocercas.length === MAX_GEOCERCAS) {
    logger.warn(
      { limit: MAX_GEOCERCAS },
      "The organization has more geofences than one page: some are not shown"
    );
  }
  return NextResponse.json(lugares);
}
