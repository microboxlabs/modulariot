import { z } from "zod";
import { createCalendarClient } from "../../utils/miot-calendar-api-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import {
  handleMiotCalendarApiError,
  parseJsonBody,
} from "../../utils/calendar-route-utils";
import { NextResponse } from "next/server";

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
    return handleMiotCalendarApiError(
      error,
      "Failed to fetch calendar groups",
      "Failed to fetch calendar groups"
    );
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const bodyResult = await parseJsonBody(request);
  if ("error" in bodyResult) return bodyResult.error;
  const parsed = CalendarGroupSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const client = createCalendarClient(authResult.session);

  try {
    const group = await client.groups.create(parsed.data);
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    return handleMiotCalendarApiError(
      error,
      "Failed to create calendar group",
      "Failed to create calendar group"
    );
  }
}
