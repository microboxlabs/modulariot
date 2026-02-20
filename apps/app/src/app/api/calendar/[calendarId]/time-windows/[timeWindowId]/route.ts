import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
import { createCalendarClient } from "../../../../utils/miot-calendar-api-client";
import { requireAuth } from "../../../../utils/alfresco-crud-client";
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

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ calendarId: string; timeWindowId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  try {
    const { calendarId, timeWindowId } = await params;
    const parsed = TimeWindowRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const client = createCalendarClient(authResult.session);
    const timeWindow = await client.calendars.updateTimeWindow(
      calendarId,
      timeWindowId,
      parsed.data
    );
    return NextResponse.json(timeWindow);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to update time window");
    return NextResponse.json({ error: "Failed to update time window" }, { status });
  }
}
