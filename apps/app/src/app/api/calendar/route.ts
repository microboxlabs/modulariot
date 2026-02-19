import { createMiotCalendarClient, MiotCalendarApiError } from "@microboxlabs/miot-calendar-client";
import { requireAuth } from "../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

export async function GET() {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    const calendars = await client.calendars.list({ active: true });
    return NextResponse.json(calendars);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to fetch calendars");
    return NextResponse.json({ error: "Failed to fetch calendars" }, { status });
  }
}
