import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { getInfoEntityGuest } from "@/features/common/providers/alfresco-api/alfresco-api.provider";

export async function GET(req: NextRequest) {
  const licencePlate = req.nextUrl.searchParams.get("licencePlate");

  if (!licencePlate) {
    return NextResponse.json(
      { error: "Licence Plate is required" },
      { status: 400 }
    );
  }

  try {
    const response = await getInfoEntityGuest(licencePlate);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: "Error fetching entity info" },
      { status: 500 }
    );
  }
}
