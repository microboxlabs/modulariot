import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import { Readable } from "stream";

const FLEET_TRIP_API_URL = `${process.env.STREAMHUB_IOT_URL}/api/v1/avl/fleet/trip/positions`;

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { MapPosition } from "./route.type";
import { parseWKBPoint } from "@/utils/map-conversion";
import { mapLogger } from "@/lib/logger";
import {
  forwardControlTowerMap,
  positionsAsEvents,
  SSE_HEADERS,
} from "@/app/api/utils/control-tower-map";
import {
  isEngineCaseId,
  isTripsModuleTripId,
  tripIdOf,
} from "@/features/symptoms/model/treatment-link";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

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

  // The AVL API knows only the GPS database's trips; the modulith reads a
  // trips-module trip, and any trip when there is no AVL API.
  if (!process.env.STREAMHUB_IOT_URL || isTripsModuleTripId(tripId)) {
    return positionsAsEvents(
      await forwardControlTowerMap(
        `trips/${encodeURIComponent(tripId)}/positions`,
        `?assetId=${encodeURIComponent(assetId)}`
      )
    );
  }

  // Create a TransformStream for CSV processing
  const { readable, writable } = new TransformStream();
  // Start streaming process
  streamPositions(tripId, assetId, writable).catch((error) => {
    mapLogger.error(
      { err: error, tripId, assetId },
      "Failed to stream trip positions"
    );
  });

  // Return streaming response
  return new Response(readable, { headers: SSE_HEADERS });
}

async function streamPositions(
  tripId: string,
  assetId: string,
  writable: WritableStream
) {
  const writer = writable.getWriter();
  const token = await authToken.getToken();

  try {
    const response = await fetch(
      `${FLEET_TRIP_API_URL}?tripId=${tripId}&assetId=${assetId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Read the entire response as text first, then create a readable stream
    const responseText = await response.text();

    const csvStream = Readable.from([responseText]);
    const parser = parse({
      columns: (headers: string[]) =>
        headers.map((h: string) => h.toLowerCase()),
      delimiter: ";",
      trim: true,
    });

    for await (const record of csvStream.pipe(parser)) {
      const [longitude, latitude] = parseWKBPoint(
        (record as MapPosition).location
      );

      const newRecord: MapPosition = {
        ...record,
        longitude,
        latitude,
      } as MapPosition;

      // Format data according to SSE protocol
      await writer.write(`data: ${JSON.stringify(newRecord)}\n\n`);
    }
    await writer.close();
  } catch (error) {
    mapLogger.error(
      { err: error, tripId, assetId },
      "Error streaming trip positions"
    );
    try {
      await writer.write(
        `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`
      );
    } catch {
      // Writer may already be closed
    }
  } finally {
    try {
      await writer.close();
    } catch {
      // Writer may already be closed
    }
  }
}
