import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
import { createCalendarClient } from "../utils/miot-calendar-api-client";
import { requireAuth } from "../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

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
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch calendars");
    return NextResponse.json({ error: "Failed to fetch calendars" }, { status });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = CalendarRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const client = createCalendarClient(authResult.session);

  try {
    const calendar = await client.calendars.create(parsed.data);
    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to create calendar");
    return NextResponse.json({ error: "Failed to create calendar" }, { status });
  }
}
