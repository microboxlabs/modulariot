import { auth } from "@/auth";
import { getNotifications } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new Error("Unauthorized");
    }

    const response = await getNotifications(session);
    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
