import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { createCalendarClient } from "../../../../utils/miot-calendar-api-client";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import dayjs from "dayjs";

const MAX_RANGE_DAYS = 90;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Both dates or neither (the calendar then defaults to the next 7 days); the span is capped. */
function validateRange(
  startDate: string | undefined,
  endDate: string | undefined
): string | null {
  for (const date of [startDate, endDate]) {
    if (
      date !== undefined &&
      (!ISO_DATE.test(date) || !dayjs(date).isValid())
    ) {
      return "startDate and endDate must be YYYY-MM-DD";
    }
  }
  if ((startDate === undefined) !== (endDate === undefined)) {
    return "Give both startDate and endDate, or neither";
  }
  if (startDate && endDate) {
    const days = dayjs(endDate).diff(dayjs(startDate), "day");
    if (days < 0) return "endDate must not be before startDate";
    if (days > MAX_RANGE_DAYS) {
      return `The range must not exceed ${MAX_RANGE_DAYS} days`;
    }
  }
  return null;
}

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
  const rangeError = validateRange(startDate, endDate);
  if (rangeError) {
    return NextResponse.json({ error: rangeError }, { status: 400 });
  }
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
