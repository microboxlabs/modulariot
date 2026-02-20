import { z } from "zod";
import { createCalendarClient } from "../utils/miot-calendar-api-client";
import { requireAuth } from "../utils/alfresco-crud-client";
import {
  handleMiotCalendarApiError,
  parseJsonBody,
} from "../utils/calendar-route-utils";
import { NextResponse } from "next/server";

const CalendarRequestSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  timezone: z.string().optional(),
  active: z.boolean().optional(),
  groups: z.array(z.string()).optional(),
});

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const client = createCalendarClient(authResult.session);

  try {
    const calendars = await client.calendars.list({ active: true });
    return NextResponse.json(calendars);
  } catch (error) {
    return handleMiotCalendarApiError(
      error,
      "Failed to fetch calendars",
      "Failed to fetch calendars"
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const bodyResult = await parseJsonBody(request);
  if ("error" in bodyResult) return bodyResult.error;
  const parsed = CalendarRequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const client = createCalendarClient(authResult.session);

  try {
    const calendar = await client.calendars.create(parsed.data);
    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    return handleMiotCalendarApiError(
      error,
      "Failed to create calendar",
      "Failed to create calendar"
    );
  }
}
