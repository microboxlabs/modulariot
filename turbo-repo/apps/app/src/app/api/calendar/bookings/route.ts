import {
  createMiotCalendarClient,
  MiotCalendarApiError,
  type BookingResponse,
} from "@microboxlabs/miot-calendar-client";
import {
  requireAuth,
  requireAnyGroup,
} from "../../utils/alfresco-crud-client";

// Booking mutations are gated on either GROUP_PLANNING (slot/time changes)
// or GROUP_ASSIGNMENT (carrier/driver/truck changes) — pure
// GROUP_CALENDAR_VIEWER users are rejected with 403. The route doesn't try
// to split the two further: by the time a request reaches the calendar
// backend the payload may carry both kinds of change in one move, and the
// UI never sends a viewer-shaped request anyway. GET stays on requireAuth.
const BOOKING_MUTATION_GROUPS = [
  "GROUP_PLANNING",
  "GROUP_ASSIGNMENT",
] as const;
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { endTask } from "@/features/common/providers/alfresco-api/alfresco-api.provider";
import type { Session } from "next-auth";
import { extractCalendarBindingPayload } from "./binding-extractor";
import { runCalendarBinding } from "./binding-helpers";
import { isOriginTaskDriven } from "@/features/calendar/services/task-driven-origin";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

type BookingSlot = {
  date: string;
  hour: number;
  minutes: number;
};

type TaskAdvance = {
  taskId: string;
  transitionId: string;
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
  /**
   * Optional Alfresco workflow advance to run as part of the same operation.
   * Booking is written first; if the task transition fails, the booking
   * created in this request is canceled (compensation). When the booking
   * already existed (409 conflict), we do not cancel — only the just-created
   * booking is rolled back.
   */
  taskAdvance?: TaskAdvance;
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

type CalendarClient = ReturnType<typeof createMiotCalendarClient>;

type BookingResolution =
  | { booking: BookingResponse; status: 200 | 201; created: boolean }
  | { error: NextResponse };

/**
 * Writes the booking, transparently treating a 409 with a matching existing
 * booking as success. Returns the booking plus whether it was newly created
 * (callers need this to know whether to compensate on later failure).
 */
async function resolveBooking(
  client: CalendarClient,
  body: AppBookingRequest
): Promise<BookingResolution> {
  try {
    const booking = await client.bookings.create(body);
    return { booking, status: 201, created: true };
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
          return { booking: matchingBooking, status: 200, created: false };
        }
      } catch (lookupError) {
        logger.warn(
          { err: lookupError, resourceId: body.resource.id },
          "Failed to look up existing booking after conflict"
        );
      }
    }

    logger.error({ err: error }, "Failed to create booking");
    return {
      error: NextResponse.json(
        {
          error:
            error instanceof MiotCalendarApiError
              ? error.message
              : "Failed to create booking",
        },
        { status }
      ),
    };
  }
}

/**
 * Compensates a just-created booking after a downstream failure. Only logs on
 * cancel failure — the caller still surfaces the original error to the user.
 */
async function compensateBooking(
  client: CalendarClient,
  bookingId: string,
  cause: unknown
): Promise<{ compensated: boolean }> {
  try {
    await client.bookings.cancel(bookingId);
    return { compensated: true };
  } catch (cancelError) {
    logger.error(
      { err: cancelError, bookingId, cause },
      "Failed to compensate booking after task-advance failure — manual cleanup required"
    );
    return { compensated: false };
  }
}

/**
 * Resolve the service's origin delegate code from the booking's
 * `resource.data` blob. `origen` is the canonical key the planner persists
 * (`SelectedService.origen`, populated from `mintral_originDelegateCode`);
 * the longer key is checked as a defensive fallback for bookings written
 * through paths that store the raw Alfresco field name. Returns undefined
 * when the field is missing or not a non-empty string.
 */
function readOrigin(data: Record<string, unknown> | undefined): string | undefined {
  if (!data) return undefined;
  const candidates = [data.origen, data.mintral_originDelegateCode];
  for (const value of candidates) {
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

async function runTaskAdvance(
  session: Session,
  advance: TaskAdvance
): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
  try {
    await endTask(session, advance.taskId, advance.transitionId);
    return { ok: true };
  } catch (error) {
    logger.error(
      { err: error, taskId: advance.taskId, transitionId: advance.transitionId },
      "Failed to advance workflow task"
    );
    const message =
      error instanceof Error ? error.message : "Failed to advance task";
    return { ok: false, status: 502, message };
  }
}


export async function POST(request: Request) {
  const authResult = await requireAnyGroup(BOOKING_MUTATION_GROUPS);
  if (!authResult.authorized) return authResult.response;

  const body: AppBookingRequest = await request.json();
  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  const resolved = await resolveBooking(client, body);
  if ("error" in resolved) return resolved.error;

  // Task-driven origins skip the binding call entirely: ECM task listeners
  // reconcile the calendar binding off the workflow task move alone. With no
  // binding call, the cancel-booking-on-binding-failure compensation is dead
  // for this path and is not executed. Flag-off origins keep today's behavior.
  const originCode = readOrigin(body.resource?.data);
  if (!isOriginTaskDriven(originCode)) {
    // Tell the coordinator about this calendar binding *before* the workflow
    // advance. The coordinator dispatches based on stage:
    //   - planned (no full tuple)  → record the binding, no Alerce.
    //   - assigned (full tuple)    → resolve UUIDs → push to Alerce → record.
    // A failure on stage=assigned is hard: the binding webscript leaves
    // process variables untouched on Alerce 4xx/5xx, we cancel the
    // just-created booking, and the user can retry. Failures on stage=planned
    // are also hard: an unbacked booking would drift from the trip's
    // process state, so we cancel and surface the error.
    // Bookings with no `mintral_serviceCode` (non-planner-driven) skip the
    // call entirely.
    const bindingPayload = extractCalendarBindingPayload(body);
    if (bindingPayload) {
      const bindingResult = await runCalendarBinding(
        authResult.session,
        bindingPayload
      );
      if (!bindingResult.ok) {
        let compensated: boolean | undefined;
        if (resolved.created) {
          const compensation = await compensateBooking(
            client,
            resolved.booking.id,
            bindingResult.message
          );
          compensated = compensation.compensated;
        }
        return NextResponse.json(
          {
            error: bindingResult.message,
            calendarBindingFailed: true,
            bookingCompensated: compensated,
          },
          { status: bindingResult.status }
        );
      }
    }
  }

  if (!body.taskAdvance) {
    return NextResponse.json(resolved.booking, { status: resolved.status });
  }

  const advanceResult = await runTaskAdvance(
    authResult.session,
    body.taskAdvance
  );
  if (advanceResult.ok) {
    return NextResponse.json(resolved.booking, { status: resolved.status });
  }

  let compensated: boolean | undefined;
  if (resolved.created) {
    const compensation = await compensateBooking(
      client,
      resolved.booking.id,
      advanceResult.message
    );
    compensated = compensation.compensated;
  }

  return NextResponse.json(
    {
      error: advanceResult.message,
      taskAdvanceFailed: true,
      bookingCompensated: compensated,
    },
    { status: advanceResult.status }
  );
}
