import {
  createMiotCalendarClient,
  MiotCalendarApiError,
} from "@microboxlabs/miot-calendar-client";
import { requireAuth } from "../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

type BookingSlot = {
  date: string;
  hour: number;
  minutes: number;
};

type AppBookingRequest = {
  calendarId: string;
  resource: {
    id: string;
    type?: string;
    label?: string;
    data?: Record<string, unknown>;
  };
  slot: BookingSlot;
};

function isSameSlot(
  left: BookingSlot | null | undefined,
  right: BookingSlot | null | undefined
) {
  return (
    left?.date === right?.date &&
    left?.hour === right?.hour &&
    left?.minutes === right?.minutes
  );
}

export async function GET(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { searchParams } = new URL(request.url);
  const calendarId = searchParams.get("calendarId") ?? undefined;
  const startDate = searchParams.get("startDate") ?? undefined;
  const endDate = searchParams.get("endDate") ?? undefined;

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    const bookings = await client.bookings.list({
      calendarId,
      startDate,
      endDate,
    });
    return NextResponse.json(bookings);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to list bookings");
    return NextResponse.json({ error: "Failed to list bookings" }, { status });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const body: AppBookingRequest = await request.json();
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
    if (status === 409) {
      try {
        const existing = await client.bookings.listByResource(body.resource.id);
        const matchingBooking = existing.data.find(
          (booking: { calendarId: string; slot?: BookingSlot | null }) =>
            booking.calendarId === body.calendarId &&
            isSameSlot(booking.slot, body.slot)
        );

        if (matchingBooking) {
          return NextResponse.json(matchingBooking, { status: 200 });
        }
      } catch (lookupError) {
        logger.warn(
          { err: lookupError, resourceId: body.resource.id },
          "Failed to look up existing booking after conflict"
        );
      }
    }

    logger.error({ err: error }, "Failed to create booking");
    return NextResponse.json(
      {
        error:
          error instanceof MiotCalendarApiError
            ? error.message
            : "Failed to create booking",
      },
      { status }
    );
  }
}
