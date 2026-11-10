import { auth } from "@/auth";
import { NextResponse } from "next/server";

import { forwardControlTowerMap } from "@/app/api/utils/control-tower-map";

/** The evaluator's symptoms with their cases on a trip (`id`: trip id or service code). */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({
      status: 401,
    });
  }
  const { searchParams } = new URL(request.url);
  const trip = searchParams.get("id")?.trim();
  if (!trip) {
    return NextResponse.json({ trip: "", symptoms: [] });
  }
  return forwardControlTowerMap(`trips/${encodeURIComponent(trip)}/symptoms`);
}
