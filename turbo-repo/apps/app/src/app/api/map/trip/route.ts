import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

import {
  forwardControlTowerMap,
  positionsAsEvents,
} from "@/app/api/utils/control-tower-map";
import {
  isEngineCaseId,
  tripIdOf,
} from "@/features/symptoms/model/treatment-link";

/**
 * The positions of a trip, or of an evaluator's case without a trip, as
 * server-sent events from the modulith. A trip id is a trips-module UUID or a
 * GPS-database trip (the service code the task page sends).
 */
export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tripId = tripIdOf(req.nextUrl.searchParams.get("tripId"));
  const symptomId = req.nextUrl.searchParams.get("symptomId")?.trim() ?? "";

  // An evaluator's case without a trip: the modulith picks its vehicle and time range.
  if (!tripId && isEngineCaseId(symptomId)) {
    return positionsAsEvents(
      await forwardControlTowerMap(
        `symptoms/${encodeURIComponent(symptomId)}/positions`
      )
    );
  }

  if (!tripId)
    return NextResponse.json({ error: "Missing tripId" }, { status: 400 });

  const assetId = req.nextUrl.searchParams.get("assetId") || "";
  if (!assetId)
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });

  return positionsAsEvents(
    await forwardControlTowerMap(
      `trips/${encodeURIComponent(tripId)}/positions`,
      `?assetId=${encodeURIComponent(assetId)}`
    )
  );
}
