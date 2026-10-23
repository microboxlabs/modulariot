import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { parse } from "csv-parse";
import { Readable } from "stream";

import { getSharedAuthToken } from "../../utils/streamhub-api-client";
import { parseWKBPoint } from "@/utils/map-conversion";
import { HistoricSignal } from "@/features/signal-history/types/historic-signal.type";
import {
  forwardControlTowerMap,
  isoDate,
  positionsAsEvents,
  SSE_HEADERS,
} from "@/app/api/utils/control-tower-map";
import { withDistances } from "@/features/signal-history/utils/signal-legs";

const FLEET_TRIP_API_URL = `${process.env.STREAMHUB_IOT_URL}/api/v1/avl/fleet/streaming/positions`;

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

  // Without the AVL API, the modulith reads the asset's signals as the active organization.
  if (!process.env.STREAMHUB_IOT_URL) {
    const range = new URLSearchParams({
      from: isoDate(p_from),
      to: isoDate(p_to),
    });
    return positionsAsEvents(
      await forwardControlTowerMap(
        `assets/${encodeURIComponent(assetId.trim())}/positions`,
        `?${range.toString()}`
      ),
      withDistances<HistoricSignal>
    );
  }

  // Strings written to the stream go out as UTF-8 bytes.
  const { readable, writable } = new TextEncoderStream();

  // Errors are logged and close the stream.
  void streamPositions(assetId, p_from, p_to, writable);

  // Return streaming response
  return new Response(readable, { headers: SSE_HEADERS });
}

async function streamPositions(
  assetId: string,
  p_from: string,
  p_to: string,
  writable: WritableStream
) {
  const writer = writable.getWriter();

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

  try {
    const encodedStartDate = encodeURIComponent(formatToStreamHub(p_from));
    const encodedEndDate = encodeURIComponent(formatToStreamHub(p_to));
    const token = await authToken.getToken();
    const response = await fetch(
      `${FLEET_TRIP_API_URL}?assetId=${encodeURIComponent(assetId)}&startDate=${encodedStartDate}&endDate=${encodedEndDate}`,
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

    for await (const record of nodeStream.pipe(parser)) {
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
  } catch (error) {
    console.error("Error streaming positions:", error);
    // The client tells this failure from the stream's normal end.
    await writer
      .write(
        `event: failed\ndata: ${JSON.stringify({ error: String(error) })}\n\n`
      )
      .catch(() => {});
  } finally {
    await writer.close().catch(() => {});
  }
}
