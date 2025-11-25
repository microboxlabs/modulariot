import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  calculateETA,
  ETARequest,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }

    const body = (await request.json()) as ETARequest;

    // Validate required fields
    if (!body.originGeofence || !body.destinationGeofence) {
      return NextResponse.json(
        { error: "Origin and destination geofences are required", status: 400 },
        { status: 400 }
      );
    }

    // Call Alfresco webscript to calculate ETA
    const etaData = await calculateETA(session, {
      originGeofence: body.originGeofence,
      destinationGeofence: body.destinationGeofence,
      doubleDriver: body.doubleDriver || false,
      percentile: body.percentile || "p75",
      startDate: body.startDate || new Date().toISOString(),
    });

    return NextResponse.json(etaData);
  } catch (error: any) {
    logger.error("Error calculating ETA:", error);

    if (error?.status === 401) {
      return NextResponse.json(
        { error: "Unauthorized", status: 401 },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: error?.message || "Failed to calculate ETA",
        status: error?.status || 500,
      },
      { status: error?.status || 500 }
    );
  }
}
