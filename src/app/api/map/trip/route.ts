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

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

export async function GETa(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }
  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.error();

  try {
    const token = await authToken.getToken();
    console.log(token);
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");
    const chunkSize = 100;

    if (!tripId) {
      return NextResponse.json({ error: "Missing tripId" }, { status: 400 });
    }

    const params = new URLSearchParams();
    params.set("tripId", tripId);
    /* const response = await fetch(FLEET_TRIP_API_URL + "?" + params.toString(), {
      headers: {
        accept: "application/json",
        Authorization: ` Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get CSV data from response
    const csvString = await response.text();
    console.log(csvString);
    const csvStream = Readable.from(csvString);

    const parser = parse({
      columns: (headers) => headers.map((h: string) => h.toLowerCase()),
      skip_empty_lines: true,
      delimiter: ";",
      trim: true,
      relax_quotes: true,
      encoding: "utf-8",
    });

    const positions: any[] = [];
    let currentIndex = 0;

    for await (const record of csvStream.pipe(parser)) {
      // Skip records before offset
      if (currentIndex++ < offset) continue;

      const lowercaseRecord = Object.entries(record).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: typeof value === "string" ? value.toLowerCase() : value,
        }),
        {},
      );
      positions.push(lowercaseRecord);

      // Return when we have enough records for this chunk
      if (positions.length >= chunkSize) {
        return NextResponse.json({
          data: positions,
          hasMore: true,
        });
      }
    }

    // Return remaining records
    return NextResponse.json({
      data: positions,
      hasMore: false,
    }); */
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch trip positions",
        errorMessage: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.next({ status: 401 });

  const tripId = req.nextUrl.searchParams.get("tripId");
  if (!tripId) return NextResponse.next({ status: 400 });

  // Create a TransformStream for CSV processing
  const { readable, writable } = new TransformStream();

  // Start streaming process
  streamPositions(tripId, writable).catch(console.error);

  // Return streaming response
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function streamPositions(tripId: string, writable: WritableStream) {
  const writer = writable.getWriter();
  const token = await authToken.getToken();

  try {
    const response = await fetch(`${FLEET_TRIP_API_URL}?tripId=${tripId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const csvStream = Readable.from(response.body);
    const parser = parse({
      columns: (headers) => headers.map((h) => h.toLowerCase()),
      delimiter: ";",
      trim: true,
    });

    for await (const record of csvStream.pipe(parser)) {
      const position = processRecord(record);
      await writer.write(`data: ${JSON.stringify(position)}\n\n`);
    }
  } finally {
    await writer.close();
  }
}
