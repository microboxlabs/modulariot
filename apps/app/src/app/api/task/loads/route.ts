import { auth } from "@/auth";
import { NextResponse, NextRequest } from "next/server";
import { getTripLoads } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const tripId = req.nextUrl.searchParams.get("tripId");

    if (!tripId) {
      throw new Error("Trip ID is required");
    }

    const response = await getTripLoads(session, tripId);

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        data: {},
        status: 500,
        message: "Failed to fetch symptoms data: " + error,
      },
      { status: 500 }
    );
  }
}
