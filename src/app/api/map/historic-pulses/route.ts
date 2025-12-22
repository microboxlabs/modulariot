import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import { Readable } from "stream";

const FLEET_TRIP_API_URL =
  "https://iot.streamhub.cl/api/v1/avl/fleet/streaming/positions";

// `/app/api/map/historic-pulses?assetId=${assetId}&p_from=${p_from}&p_to=${p_to}`

import {
  AuthToken,
  AuthTokenConfig,
} from "@/features/common/providers/sreamhub-api/streamhub-api.provider";
import { parseWKBPoint } from "@/utils/map-conversion";
import { HistoricSignal } from "@/features/signal-history/types/historic-signal.type";

const config: AuthTokenConfig = {
  clientId: `${process.env.STREAMHUB_CLIENT_ID}`,
  clientSecret: `${process.env.STREAMHUB_CLIENT_SECRET}`,
  audience: `${process.env.STREAMHUB_AUDIENCE}`,
  grantType: "client_credentials",
};

const authToken = new AuthToken(config);

// Function to format date to StreamHub API format: YYYY-MM-DDTHH:mm:ss -0000
function formatDateForStreamHub(dateString: string): string {
  // Handle different input formats
  let date: Date;

  if (dateString.includes("T")) {
    // Already has time part
    date = new Date(dateString);
  } else if (dateString.includes(" ")) {
    // Format like "2025-12-21 00:00"
    date = new Date(dateString.replace(" ", "T") + ":00");
  } else {
    // Just date, assume start of day
    date = new Date(dateString + "T00:00:00");
  }

  // Format to StreamHub required format
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds} -0000`;
}

export async function GET(req: NextRequest) {
  const session = await auth();

  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const assetId = req.nextUrl.searchParams.get("assetId") || "";
  if (!assetId)
    return NextResponse.json({ error: "Missing assetId" }, { status: 400 });

  const p_from = req.nextUrl.searchParams.get("p_from") || "";
  if (!p_from)
    return NextResponse.json({ error: "Missing p_from" }, { status: 400 });

  const p_to = req.nextUrl.searchParams.get("p_to") || "";
  if (!p_to)
    return NextResponse.json({ error: "Missing p_to" }, { status: 400 });

  // Create a TransformStream for CSV processing
  const { readable, writable } = new TransformStream();

  // Start streaming process
  streamPositions(assetId, p_from, p_to, writable).catch((_error) => {
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
  assetId: string,
  p_from: string,
  p_to: string,
  writable: WritableStream
) {
  const writer = writable.getWriter();
  const token = await authToken.getToken();

  // Format dates to StreamHub API format
  const formattedStartDate = formatDateForStreamHub(p_from);
  const formattedEndDate = formatDateForStreamHub(p_to);

  try {
    const startTime = Date.now();
    console.log(`🚀 Starting fetch at: ${new Date(startTime).toISOString()}`);

    const response = await fetch(
      `${FLEET_TRIP_API_URL}?assetId=${assetId}&startDate=${formattedStartDate}&endDate=${formattedEndDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const fetchTime = Date.now() - startTime;
    console.log(`⏱️  Fetch completed in: ${fetchTime}ms`);

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    // Log headers to check if streaming is supported
    console.log("=== RESPONSE HEADERS ===");
    response.headers.forEach((value, key) => {
      console.log(`${key}: ${value}`);
    });

    // Check specific streaming indicators
    const transferEncoding = response.headers.get("transfer-encoding");
    const contentLength = response.headers.get("content-length");

    console.log(`Transfer-Encoding: ${transferEncoding}`);
    console.log(`Content-Length: ${contentLength}`);

    if (transferEncoding === "chunked") {
      console.log("✅ API supports chunked transfer encoding - TRUE STREAMING");
    } else if (!contentLength) {
      console.log("⚠️  No content-length - might be streaming");
    } else {
      console.log(
        "❌ Fixed content-length - NOT streaming, all data sent at once"
      );
    }

    // Read the entire response as text first, then create a readable stream
    console.log(
      "🔄 Processing response as TRUE STREAM (not waiting for full download)"
    );

    if (!response.body) {
      throw new Error("No response body available");
    }

    // Convert ReadableStream to Node.js stream and process chunks as they arrive
    function webStreamToNodeReadable(webStream: ReadableStream<Uint8Array>) {
      const reader = webStream.getReader();
      return new Readable({
        async read() {
          try {
            const { done, value } = await reader.read();
            if (done) {
              this.push(null);
            } else {
              this.push(Buffer.from(value));
            }
          } catch (err) {
            this.destroy(err as Error);
          }
        },
      });
    }

    const nodeStream = webStreamToNodeReadable(
      response.body as ReadableStream<Uint8Array>
    );

    const parser = parse({
      columns: (headers: string[]) =>
        headers.map((h: string) => h.toLowerCase()),
      delimiter: ";",
      trim: true,
    });

    let recordCount = 0;
    const streamStartTime = Date.now();

    for await (const record of nodeStream.pipe(parser)) {
      recordCount++;
      const processingTime = Date.now() - streamStartTime;

      // Log every 100 records to see streaming in action
      if (recordCount % 100 === 0) {
        console.log(
          `📊 Processed ${recordCount} records in ${processingTime}ms`
        );
      }

      const [longitude, latitude] = parseWKBPoint(
        (record as HistoricSignal).location
      );

      const newRecord: HistoricSignal = {
        ...record,
        longitude,
        latitude,
      } as HistoricSignal;

      // Format data according to SSE protocol
      await writer.write(`data: ${JSON.stringify(newRecord)}\n\n`);
    }

    const totalStreamTime = Date.now() - streamStartTime;
    console.log(
      `🏁 Stream completed: ${recordCount} total records in ${totalStreamTime}ms`
    );
    await writer.close();
  } catch (error) {
    // Send error event
    console.error("Error streaming positions:", error);
    /* await writer.write(
      `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`,
    ); */
  } finally {
    await writer.close();
  }
}
