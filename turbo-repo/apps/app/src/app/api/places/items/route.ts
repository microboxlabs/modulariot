import { NextResponse } from "next/server";
import { z } from "zod";
import { forwardToQuarkus } from "@/app/api/utils/quarkus-proxy";
import { resolveTenantScope } from "@/app/api/utils/tenant-scope";
import {
  guardadosDesdePlaces,
  placeRequestSchema,
  placeViewSchema,
  type PlaceView,
} from "@/features/places/data/saved-places";
import { logger } from "@/lib/logger";

/** Read every page so the map and its local search include everything saved. */
const PAGE_SIZE = 2000;

const placesSchema = z.array(placeViewSchema);

async function leerPagina(org: string, page: number) {
  const upstream = await forwardToQuarkus(
    `/api/v1/orgs/${org}/places/items?size=${PAGE_SIZE}&page=${page}`
  );
  if (!upstream.ok) return upstream;
  const parsed = placesSchema.safeParse(
    await upstream.json().catch(() => null)
  );
  if (parsed.success) return parsed.data;
  logger.error(
    { err: parsed.error },
    "miot-places answered saved places in an unexpected shape"
  );
  return NextResponse.json(
    { error: "Failed to load saved places" },
    { status: 502 }
  );
}

/**
 * GET /app/api/places/items
 *
 * The organization's saved places (miot-places, `miot_places.place`), split
 * into Lugares' places (geofences and inner geofences) and routes. The
 * modulith scopes them to the caller's active organization.
 */
export async function GET() {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;

  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  const places: PlaceView[] = [];
  for (let page = 0; ; page++) {
    const pagina = await leerPagina(org, page);
    if (pagina instanceof NextResponse) return pagina;
    places.push(...pagina);
    if (pagina.length < PAGE_SIZE) break;
  }
  return NextResponse.json(guardadosDesdePlaces(places));
}

/**
 * POST /app/api/places/items — saves a new geofence, with its inner
 * geofences, or route; it starts at version 1.0.0. The modulith checks
 * `controltower:places.edit` and the shape.
 */
export async function POST(request: Request) {
  const scope = await resolveTenantScope();
  if (!scope.resolved) return scope.response;

  const body = placeRequestSchema.safeParse(
    await request.json().catch(() => null)
  );
  if (!body.success) {
    return NextResponse.json({ error: "Invalid place" }, { status: 400 });
  }
  const org = encodeURIComponent(scope.scope.activeOrg.slug);
  return forwardToQuarkus(`/api/v1/orgs/${org}/places/items`, {
    method: "POST",
    body: body.data,
  });
}
