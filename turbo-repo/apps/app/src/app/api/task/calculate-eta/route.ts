import "server-only";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import {
  calculateETA,
  ETARequest,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import {
  handleApiError,
  unauthorizedResponse,
  badRequestResponse,
} from "@/app/api/utils/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return unauthorizedResponse();
    }

    const body = (await request.json()) as ETARequest;

    // Validate required fields
    if (!body.originGeofence || !body.destinationGeofence) {
      return badRequestResponse("Origin and destination geofences are required");
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
  } catch (error: unknown) {
    return handleApiError(error, "calculating ETA", "Failed to calculate ETA. Please try again.");
  }
}
