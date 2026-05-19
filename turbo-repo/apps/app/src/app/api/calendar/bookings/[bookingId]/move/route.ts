import {
  createMiotCalendarClient,
  MiotCalendarApiError,
  type BookingResponse,
} from "@microboxlabs/miot-calendar-client";
import { requireAnyGroup } from "../../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";
import {
  extractCalendarBindingPayload,
  runCalendarBinding,
} from "../../binding-helpers";

const MIOT_CALENDAR_URL = process.env.MIOT_CALENDAR_URL ?? "";

// Same gate as the create/cancel routes — see ../../route.ts.
const BOOKING_MUTATION_GROUPS = [
  "GROUP_PLANNING",
  "GROUP_ASSIGNMENT",
] as const;

const MoveBodySchema = z.object({
  slot: z.object({
    date: z.string().min(1),
    hour: z.number().int().min(0).max(23),
    minutes: z.number().int().min(0).max(59),
  }),
  resource: z
    .object({
      id: z.string().min(1),
      type: z.string().optional(),
      label: z.string().optional(),
      data: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});
type MoveBody = z.infer<typeof MoveBodySchema>;

type CalendarClient = ReturnType<typeof createMiotCalendarClient>;
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: NextResponse };

/**
 * Reverse-move compensation: re-issue a move using the pre-move snapshot so
 * the booking lands back where it started. Only logs on failure — the caller
 * still surfaces the original (binding) error to the user.
 */
async function compensateMove(
  client: CalendarClient,
  bookingId: string,
  original: BookingResponse,
  cause: unknown
): Promise<{ compensated: boolean }> {
  try {
    await client.bookings.move(bookingId, {
      slot: original.slot,
      resource: original.resource,
    });
    return { compensated: true };
  } catch (error) {
    logger.error(
      { err: error, bookingId, cause },
      "Failed to compensate move after calendar-binding failure — manual cleanup may be required"
    );
    return { compensated: false };
  }
}

async function parseMoveBody(request: Request): Promise<Result<MoveBody>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      ),
    };
  }
  const parsed = MoveBodySchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error: NextResponse.json(
        { error: "slot { date, hour, minutes } is required" },
        { status: 400 }
      ),
    };
  }
  return { ok: true, value: parsed.data };
}

/**
 * Snapshot the pre-move state so we can reverse the move if the downstream
 * calendar-binding call fails. The booking id is stable across a move so
 * this is just one extra GET, not a wholly different write.
 */
async function snapshotBooking(
  client: CalendarClient,
  bookingId: string
): Promise<Result<BookingResponse>> {
  try {
    return { ok: true, value: await client.bookings.get(bookingId) };
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    if (status === 404) {
      return {
        ok: false,
        error: NextResponse.json(
          { error: "Booking not found" },
          { status: 404 }
        ),
      };
    }
    logger.error({ err: error, bookingId }, "Failed to load booking for move");
    return {
      ok: false,
      error: NextResponse.json(
        { error: "Failed to load booking" },
        { status }
      ),
    };
  }
}

async function executeMove(
  client: CalendarClient,
  bookingId: string,
  body: MoveBody
): Promise<Result<BookingResponse>> {
  try {
    return { ok: true, value: await client.bookings.move(bookingId, body) };
  } catch (error) {
    const status = error instanceof MiotCalendarApiError ? error.status : 500;
    const message =
      error instanceof MiotCalendarApiError
        ? error.message
        : "Failed to move booking";
    logger.error({ err: error, bookingId }, "Failed to move booking");
    return {
      ok: false,
      error: NextResponse.json({ error: message }, { status }),
    };
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const authResult = await requireAnyGroup(BOOKING_MUTATION_GROUPS);
  if (!authResult.authorized) return authResult.response;

  const { bookingId } = await params;

  const body = await parseMoveBody(request);
  if (!body.ok) return body.error;

  const client = createMiotCalendarClient({
    baseUrl: MIOT_CALENDAR_URL,
    headers: {
      Authorization: `Bearer ${authResult.session.user?.rawJWT ?? authResult.session.user?.ticket ?? ""}`,
    },
  });

  const snapshot = await snapshotBooking(client, bookingId);
  if (!snapshot.ok) return snapshot.error;

  const move = await executeMove(client, bookingId, body.value);
  if (!move.ok) return move.error;
  const moved = move.value;

  // Notify the coordinator about the (possibly refreshed) calendar binding.
  // Stage is derived from `resource.data` exactly like the create path — the
  // planner sets carrier+driver+truck during the "Asignar" gate, so a move
  // that crosses that gate must announce the new stage. On binding failure
  // we reverse the move so the user sees a consistent state.
  const bindingPayload = extractCalendarBindingPayload({
    calendarId: moved.calendarId,
    resource: { data: moved.resource.data },
  });
  if (!bindingPayload) return NextResponse.json(moved);

  const bindingResult = await runCalendarBinding(
    authResult.session,
    bindingPayload
  );
  if (bindingResult.ok) return NextResponse.json(moved);

  const compensation = await compensateMove(
    client,
    bookingId,
    snapshot.value,
    bindingResult.message
  );
  return NextResponse.json(
    {
      error: bindingResult.message,
      calendarBindingFailed: true,
      bookingCompensated: compensation.compensated,
    },
    { status: bindingResult.status }
  );
}
