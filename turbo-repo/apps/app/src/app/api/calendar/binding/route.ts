import { NextResponse } from "next/server";
import { requireAuth } from "../../utils/alfresco-crud-client";
import {
  notifyCalendarBinding,
  type CalendarBindingPayload,
} from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import { logger } from "@/lib/logger";

/**
 * Thin BFF for the coordinator's `POST /mintral/calendar/binding`. The
 * bookings POST handler talks to the coordinator inline, but ops fired
 * from the client *after* a separate API call (Eliminar Planificación →
 * cancelBooking → here, calendar-change → here, etc.) need their own
 * entry point.
 *
 * Server-side adds the planner's session credentials and forwards the
 * payload verbatim. Coordinator dispatches based on `stage`; failures
 * surface to the client with the upstream status code.
 */
export async function POST(request: Request) {
  const authResult = await requireAuth();
  if (!authResult.authenticated) return authResult.response;

  let payload: CalendarBindingPayload;
  try {
    payload = (await request.json()) as CalendarBindingPayload;
  } catch (error) {
    logger.warn({ err: error }, "Invalid JSON in calendar binding request");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.numero_servicio || !payload.calendar_id || !payload.stage) {
    return NextResponse.json(
      { error: "numero_servicio, calendar_id, and stage are required" },
      { status: 400 }
    );
  }

  try {
    const result = await notifyCalendarBinding(authResult.session, payload);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Calendar binding failed";
    logger.error(
      {
        err: error,
        numeroServicio: payload.numero_servicio,
        calendarId: payload.calendar_id,
        stage: payload.stage,
      },
      "Calendar binding upstream failure"
    );
    return NextResponse.json(
      { error: message, calendarBindingFailed: true },
      { status: 502 }
    );
  }
}
