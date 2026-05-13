import {
  createMiotCalendarClient,
  MiotCalendarApiError,
} from "@microboxlabs/miot-calendar-client";
import { requireAuth } from "../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { bookingId } = await params;
  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  try {
    await client.bookings.cancel(bookingId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error }, "Failed to cancel booking");
    return NextResponse.json({ error: "Failed to cancel booking" }, { status });
  }
}

const PutBodySchema = z.object({
  resource: z.object({
    id: z.string().min(1),
    type: z.string().optional(),
    label: z.string().optional(),
    data: z.record(z.string(), z.unknown()).optional(),
  }),
});

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  const { bookingId } = await params;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = PutBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "resource with a non-empty id is required" },
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
    const booking = await client.bookings.update(bookingId, {
      resource: parsed.data.resource,
    });
    return NextResponse.json(booking);
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    logger.error({ err: error, bookingId }, "Failed to update booking");
    return NextResponse.json({ error: "Failed to update booking" }, { status });
  }
}
