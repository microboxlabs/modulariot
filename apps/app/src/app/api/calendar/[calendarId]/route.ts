import { z } from "zod";
import { createCalendarClient } from "../../utils/miot-calendar-api-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import {
  handleMiotCalendarApiError,
  parseJsonBody,
} from "../../utils/calendar-route-utils";
import { NextResponse } from "next/server";

const CalendarPatchSchema = z.object({
  parallelism: z.number().int().min(1).optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
  autoSlotManager: z.boolean().optional(),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ calendarId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const bodyResult = await parseJsonBody(request);
  if ("error" in bodyResult) return bodyResult.error;
  const parsed = CalendarPatchSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { calendarId } = await params;
  const client = createCalendarClient(authResult.session);

  try {
    const current = await client.calendars.get(calendarId);
    const updated = await client.calendars.update(calendarId, {
      code: current.code,
      name: parsed.data.name ?? current.name,
      description: parsed.data.description ?? current.description,
      timezone: parsed.data.timezone ?? current.timezone,
      active: parsed.data.active ?? current.active,
      parallelism: parsed.data.parallelism ?? current.parallelism,
      autoSlotManager: parsed.data.autoSlotManager,
      groups: current.groups?.map((g) => g.code),
    });
    return NextResponse.json(updated);
  } catch (error) {
    return handleMiotCalendarApiError(
      error,
      "Failed to update calendar",
      "Failed to update calendar"
    );
  }
}
