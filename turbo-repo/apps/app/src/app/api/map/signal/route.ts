import { NextRequest, NextResponse } from "next/server";
import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";

/** Whether the asset's GPS signal is arriving, by the lost-signal detector. */
export async function GET(req: NextRequest) {
  const assetId = req.nextUrl.searchParams.get("assetId")?.trim();
  if (!assetId) {
    return NextResponse.json({ error: "assetId is required" }, { status: 400 });
  }
  return forwardControlTowerMap(`assets/${encodeURIComponent(assetId)}/signal`);
}
