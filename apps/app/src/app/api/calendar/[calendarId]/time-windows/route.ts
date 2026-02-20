import {
  createMiotCalendarClient,
  MiotCalendarApiError,
} from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
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

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { calendarId } = await params;

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

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

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    const { calendarId } = await params;
    const parsed = TimeWindowRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const timeWindow = await client.calendars.createTimeWindow(calendarId, parsed.data);
    return NextResponse.json(timeWindow, { status: 201 });
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to create time window");
    return NextResponse.json({ error: "Failed to create time window" }, { status });
  }
}
