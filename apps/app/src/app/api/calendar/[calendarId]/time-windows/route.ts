import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
import { createCalendarClient } from "../../../utils/miot-calendar-api-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const TimeWindowRequestSchema = z.object({
  name: z.string(),
  startHour: z.number(),
  endHour: z.number(),
  validFrom: z.string(),
  slotDurationMinutes: z.number().optional(),
  capacityPerSlot: z.number().optional(),
  daysOfWeek: z.string().optional(),
  validTo: z.string().optional(),
  active: z.boolean().optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { calendarId } = await params;
  const client = createCalendarClient(authResult.session);

  try {
    const timeWindows = await client.calendars.listTimeWindows(calendarId);
    return NextResponse.json(timeWindows);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch time windows");
    return NextResponse.json({ error: "Failed to fetch time windows" }, { status });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  try {
    const { calendarId } = await params;

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsed = TimeWindowRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const client = createCalendarClient(authResult.session);
    const timeWindow = await client.calendars.createTimeWindow(calendarId, parsed.data);
    return NextResponse.json(timeWindow, { status: 201 });
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to create time window");
    return NextResponse.json({ error: "Failed to create time window" }, { status });
  }
}
