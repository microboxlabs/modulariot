import { MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { z } from "zod";
import { createCalendarClient } from "../../utils/miot-calendar-api-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const CalendarGroupSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  active: z.boolean().optional(),
}).strict();

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const client = createCalendarClient(authResult.session);

  try {
    const groups = await client.groups.list({ active: true });
    return NextResponse.json(groups);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch calendar groups");
    return NextResponse.json({ error: "Failed to fetch calendar groups" }, { status });
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
  const parsed = CalendarGroupSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const client = createCalendarClient(authResult.session);

  try {
    const group = await client.groups.create(parsed.data);
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to create calendar group");
    return NextResponse.json({ error: "Failed to create calendar group" }, { status });
  }
}
