import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { createCalendarClient } from "../../../../utils/miot-calendar-api-client";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { calendarId } = await params;
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const client = createCalendarClient(authResult.session);

  try {
    const usage = await client.calendars.getTimeWindowUsage(calendarId, {
      startDate,
      endDate,
    });
    return NextResponse.json(usage);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch time window usage");
    return NextResponse.json(
      { error: "Failed to fetch time window usage" },
      { status }
    );
  }
}
