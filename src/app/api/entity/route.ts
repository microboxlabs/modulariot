import { auth } from "@/auth";
import { getInfoEntity } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const licencePlate = req.nextUrl.searchParams.get("licencePlate");
  const session = await auth();

  if (!session) {
    return NextResponse.next({
      status: 401,
    });
  }

  if (!licencePlate) {
    return NextResponse.json(
      { error: "Licence Plate is required" },
      { status: 400 }
    );
  }

  try {
    const response = await getInfoEntity(session, licencePlate);
    return NextResponse.json(response);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Error fetching entity info" },
      { status: 500 }
    );
  }
}
