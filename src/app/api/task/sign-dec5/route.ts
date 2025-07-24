import { auth } from "@/auth";
import { ecmSovosDec5 } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logger } from "@/lib/logger";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.next({
        status: 401,
      });
    }
    const json = await request.json();
    const taskId = json.taskId;
    const response = await ecmSovosDec5(session.user.ticket, taskId);

    return NextResponse.json({
      success: true,
      status: 200,
      ...response,
    });
  } catch (error: any) {
    logger.error(error);
    return NextResponse.json({
      success: false,
      status: 500,
      error: (error?.message as string) ?? "Unknown error",
    });
  }
}
