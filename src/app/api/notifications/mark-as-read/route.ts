import { auth } from "@/auth";
import { markAsRead } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { NextRequest, NextResponse } from "next/server";

export async function PUT(req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const response = await markAsRead(session, (await req.json()).id);
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        data: {},
        status: 500,
        message: "Something went wrong updating the notification:" + error,
      },
      { status: 500 },
    );
  }
}
