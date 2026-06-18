import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { fetchGeofenceCentroids } from "../../utils/pgrest-client";
import { logger } from "@/lib/logger";

/**
 * GET /app/api/calendar/geofence-coords?origin=<name>&destination=<name>
 *
 * Resolves a service's origin/destination geofence names (the same values used
 * by the ETA integration — `mintral_originDelegateCode` etc.) to polygon
 * centroids via the streamhub `geofences` table, so the assignment-step map can
 * draw the origin/destination flags and measure the vehicle's distance to the
 * origin. Either param is optional; a name that doesn't resolve comes back as
 * `null` (the flag simply isn't drawn) rather than failing the request.
 */
export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);
  const origin = searchParams.get("origin")?.trim() || null;
  const destination = searchParams.get("destination")?.trim() || null;

  if (!origin && !destination) {
    return NextResponse.json({ origin: null, destination: null });
  }

  try {
    const names = [origin, destination].filter((n): n is string => Boolean(n));
    const centroids = await fetchGeofenceCentroids(names);
    const byName = new Map(centroids.map((c) => [c.name, c]));
    const pick = (name: string | null) => {
      const c = name ? byName.get(name) : undefined;
      return c ? { latitude: c.latitude, longitude: c.longitude } : null;
    };
    return NextResponse.json({
      origin: pick(origin),
      destination: pick(destination),
    });
  } catch (error) {
    logger.error(
      { err: error, origin, destination },
      "Failed to resolve geofence coords"
    );
    return NextResponse.json(
      { error: "Failed to resolve geofence coords" },
      { status: 500 }
    );
  }
}
