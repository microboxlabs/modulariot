import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import { Readable } from "stream";

import { getSharedAuthToken } from "../../utils/streamhub-api-client";
import { parseWKBPoint } from "@/utils/map-conversion";
import { HistoricSignal } from "@/features/signal-history/types/historic-signal.type";

const FLEET_TRIP_API_URL =
  "https://iot.streamhub.cl/api/v1/avl/fleet/streaming/positions";

const authToken = getSharedAuthToken();

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

  // Format dates to StreamHub API format before encoding
  const formatToStreamHub = (dateStr: string) => {
    const clean = decodeURIComponent(dateStr);

    let normalized = clean;

    // "2025-12-28 00:00" → "2025-12-28T00:00:00"
    if (!normalized.includes("T")) {
      normalized = normalized.replace(" ", "T");
    }

    if (normalized.length === 16) {
      normalized += ":00";
    }

    const date = new Date(normalized);

    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }

    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    const hh = String(date.getUTCHours()).padStart(2, "0");
    const mi = String(date.getUTCMinutes()).padStart(2, "0");
    const ss = String(date.getUTCSeconds()).padStart(2, "0");

    // IMPORTANT: space before -0000
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss} -0000`;
  };

  // URL encode the properly formatted dates
  const encodedStartDate = encodeURIComponent(formatToStreamHub(p_from));
  const encodedEndDate = encodeURIComponent(formatToStreamHub(p_to));

  try {
    const response = await fetch(
      `${FLEET_TRIP_API_URL}?assetId=${assetId}&startDate=${encodedStartDate}&endDate=${encodedEndDate}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      console.error(`API Error: ${response.status} - ${response.statusText}`);
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

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

    for await (const record of nodeStream.pipe(parser)) {
      recordCount++;

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
