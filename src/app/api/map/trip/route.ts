import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import { Readable } from "stream";

const FLEET_TRIP_API_URL =
  "https://iot.streamhub.cl/api/v1/avl/fleet/trip/positions";

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { MapPosition } from "./route.type";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.next({ status: 401 });

  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.next({ status: 400 });

  const assetId = req.nextUrl.searchParams.get("assetId") || "";
  if (!assetId) return NextResponse.next({ status: 400 });

  // Create a TransformStream for CSV processing
  const { readable, writable } = new TransformStream();
  // Start streaming process
  streamPositions(tripId, assetId, writable).catch((_error) => {
    // TODO: Check if this is the correct way to handle the error Ignore some common errors
    //console.error("Error streaming positions:", _error);
  });

  // Return streaming response
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      //"Access-Control-Allow-Origin": "*",
    },
  });
}

async function streamPositions(
  tripId: string,
  assetId: string,
  writable: WritableStream,
) {
  const writer = writable.getWriter();
  const token = await authToken.getToken();
  //console.log("token", token);

  try {
    const response = await fetch(
      `${FLEET_TRIP_API_URL}?tripId=${tripId}&assetId=${assetId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Read the entire response as text first, then create a readable stream
    const responseText = await response.text();
    //console.log("responseText:", responseText.split("\n").length);
    const csvStream = Readable.from([responseText]);
    const parser = parse({
      columns: (headers: string[]) =>
        headers.map((h: string) => h.toLowerCase()),
      delimiter: ";",
      trim: true,
    });

    for await (const record of csvStream.pipe(parser)) {
      const [longitude, latitude] = parseWKBPoint(
        (record as MapPosition).location,
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
    // Send error event
    //console.error("Error streaming positions:", error);
    /* await writer.write(
      `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
    ); */
  } finally {
    await writer.close();
  }
}

function parseWKBPoint(wkbPoint: string): [number, number] {
  try {
    // Skip first 8 bytes (endian + type + srid) by starting from position 18
    const lonHex = wkbPoint.substring(18, 34);
    const latHex = wkbPoint.substring(34, 50);

    // Convert hex to float64
    const longitude = hexToDouble(lonHex);
    const latitude = hexToDouble(latHex);

    return [longitude, latitude];
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Error parsing WKB point:", error);
    return [-70.668505, -33.439764]; // Santiago, Chile
  }
}

function hexToDouble(hex: string): number {
  // Reverse byte order for little-endian
  const bytes = hex.match(/../g)?.reverse().join("") || "";
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);

  for (let i = 0; i < 8; i++) {
    view.setUint8(i, parseInt(bytes.substring(i * 2, i * 2 + 2), 16));
  }

  return view.getFloat64(0, false); // false for big-endian
}
