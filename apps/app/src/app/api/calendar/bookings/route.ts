import {
  createMiotCalendarClient,
  MiotCalendarApiError,
} from "@microboxlabs/miot-calendar-client";
import type { BookingRequest } from "@microboxlabs/miot-calendar-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body: BookingRequest = await request.json();
  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    const booking = await client.bookings.create(body);
    return NextResponse.json(booking, { status: 201 });
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to create booking");
    return NextResponse.json({ error: "Failed to create booking" }, { status });
  }
}
