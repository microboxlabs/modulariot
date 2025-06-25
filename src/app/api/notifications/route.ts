import { auth } from "@/auth";
import { getNotifications } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const response = await getNotifications(session.user.ticket);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        data: {},
        status: 500,
        message: "Failed to fetch symptoms data: " + error,
      },
      { status: 500 },
    );
  }
}
