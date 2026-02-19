import {
  createMiotCalendarClient,
  MiotCalendarApiError,
} from "@microboxlabs/miot-calendar-client";
import type { TimeWindowRequest } from "@microboxlabs/miot-calendar-client";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ calendarId: string; timeWindowId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { calendarId, timeWindowId } = await params;
  const body: TimeWindowRequest = await request.json();

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    const timeWindow = await client.calendars.updateTimeWindow(
      calendarId,
      timeWindowId,
      body
    );
    return NextResponse.json(timeWindow);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to update time window");
    return NextResponse.json({ error: "Failed to update time window" }, { status });
  }
}
