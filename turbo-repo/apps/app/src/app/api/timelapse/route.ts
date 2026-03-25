import { requireAuth } from "../utils/alfresco-crud-client";
import { getTimelapseMetadata } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const url = new URL(req.url);
  const licensePlate = url.searchParams.get("license_plate");
  const timestamp = url.searchParams.get("timestamp");

  if (!licensePlate || !timestamp) {
    return NextResponse.json(
      { error: "Missing license_plate or timestamp" },
      { status: 400 }
    );
  }

  try {
    const metadata = await getTimelapseMetadata(
      authResult.session,
      licensePlate,
      timestamp
    );
    return NextResponse.json(metadata);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch timelapse metadata");
    return NextResponse.json(
      { error: "Failed to fetch timelapse metadata" },
      { status: 500 }
    );
  }
}
