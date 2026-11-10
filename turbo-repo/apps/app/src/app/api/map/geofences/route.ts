import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";

import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";
import { tripIdOf } from "@/features/symptoms/model/treatment-link";

/**
 * A trip's geofences from the modulith. The trip id is a trips-module UUID or
 * a GPS-database trip (service code).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }

  const tripId = tripIdOf(req.nextUrl.searchParams.get("tripId"));
  if (!tripId)
    return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const response = await forwardControlTowerMap(
    `trips/${encodeURIComponent(tripId)}/geofences`
  );
  if (!response.ok) return response;
  return NextResponse.json({ data: await response.json() });
}
