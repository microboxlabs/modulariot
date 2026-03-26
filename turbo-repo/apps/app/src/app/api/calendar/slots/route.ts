import {
  createMiotCalendarClient,
  MiotCalendarApiError,
} from "@microboxlabs/miot-calendar-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendarId");
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;
  const available = searchParams.get("available");

  if (!calendarId) {
    return NextResponse.json(
      { error: "calendarId is required" },
      { status: 400 }
    );
  }

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    const slots = await client.slots.list({
      calendarId,
      startDate,
      endDate,
      available: available === "true" ? true : undefined,
    });
    return NextResponse.json(slots);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to list slots");
    return NextResponse.json({ error: "Failed to list slots" }, { status });
  }
}
