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

/** Read every page so the map and its local search include the whole catalog. */
const PAGE_SIZE = 2000;

const geocercasSchema = z.array(geocercaModulithSchema);

async function leerPagina(org: string, page: number) {
  const upstream = await forwardToQuarkus(
    `/api/v1/orgs/${org}/places/geofences?size=${PAGE_SIZE}&page=${page}`
  );
  if (!upstream.ok) return upstream;
  const parsed = geocercasSchema.safeParse(
    await upstream.json().catch(() => null)
  );
  if (parsed.success) return parsed.data;
  logger.error(
    { err: parsed.error },
    "miot-places answered geofences in an unexpected shape"
  );
  return NextResponse.json(
    { error: "Failed to load geofences" },
    { status: 502 }
  );
}

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
  const lugares: Lugar[] = [];
  let total = 0;
  for (let page = 0; ; page++) {
    const geocercas = await leerPagina(org, page);
    if (geocercas instanceof NextResponse) return geocercas;
    total += geocercas.length;
    for (const geocerca of geocercas) {
      const lugar = lugarDesdeGeofence(geocerca);
      if (lugar) lugares.push(lugar);
    }
    if (geocercas.length < PAGE_SIZE) break;
  }
  if (lugares.length < total) {
    logger.warn(
      { total, usable: lugares.length },
      "Some streamhub geofences have no usable polygon"
    );
  }
  return NextResponse.json(lugares);
}
