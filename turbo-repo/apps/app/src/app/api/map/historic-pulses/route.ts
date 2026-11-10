import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

import { HistoricSignal } from "@/features/signal-history/types/historic-signal.type";
import {
  forwardControlTowerMap,
  isoDate,
  positionsAsEvents,
} from "@/app/api/utils/control-tower-map";
import { withDistances } from "@/features/signal-history/utils/signal-legs";

/** The modulith answers 400 for a longer range. */
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * An asset's signals between `p_from` and `p_to`, read from the modulith as the
 * active organization and sent as server-sent events with the metres between them.
 */
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

  const from = isoDate(p_from);
  const to = isoDate(p_to);
  const span = Date.parse(to) - Date.parse(from);
  if (span > MAX_RANGE_MS) {
    return NextResponse.json(
      { error: "The range may span at most 7 days" },
      { status: 400 }
    );
  }

  return positionsAsEvents(
    await forwardControlTowerMap(
      `assets/${encodeURIComponent(assetId.trim())}/positions`,
      `?${new URLSearchParams({ from, to }).toString()}`
    ),
    withDistances<HistoricSignal>
  );
}
