import { auth } from "@/auth";
import { getNotifications } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { isEcmConfigured } from "@/features/common/providers/alfresco-api/ecm-config";
import { logError } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();

    if (!session) {
      throw new Error("Unauthorized");
    }

    // Notifications are Alfresco documents; without Alfresco there are none.
    const notificationsEnabled =
      process.env.NOTIFICATIONS_ENABLED !== "false" && isEcmConfigured();
    if (!notificationsEnabled) {
      return NextResponse.json([]);
    }

    const response = await getNotifications(session);
    return NextResponse.json(response);
  } catch (error) {
    logError(error as Error);
    return NextResponse.json({ error }, { status: 500 });
  }
}
