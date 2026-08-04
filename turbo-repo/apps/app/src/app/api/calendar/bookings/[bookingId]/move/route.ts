import {
  createMiotCalendarClient,
  MiotCalendarApiError,
  type BookingResponse,
} from "@microboxlabs/miot-calendar-client";
import { requireAnyGroup } from "../../../../utils/alfresco-crud-client";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { z } from "zod";

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
 * Planner-owned, non-tuple fields that survive a task-driven move.
 *
 * A task-driven move is otherwise slot-only (see the POST handler) because the
 * planner's frozen drag payload can carry a stale assignment tuple. But these
 * fields are owned by the planner, not by ECM, and ECM never writes them — so
 * dropping the whole blob silently discarded the user's choice: the category
 * and andén vanished on the next page load, since the grid renders from the
 * booking row (`mapBookingToPlannedService`), not from the workflow task.
 *
 * Deliberately excludes every `assigned*` field, so the stale-tuple hazard the
 * slot-only rule guards against is unchanged.
 */
const PLANNER_OWNED_FIELDS = ["serviceCategory", "_anden"] as const;

function pickPlannerFields(
  data: Record<string, unknown> | undefined
): Record<string, unknown> {
  if (!data) return {};
  const picked: Record<string, unknown> = {};
  for (const key of PLANNER_OWNED_FIELDS) {
    if (data[key] !== undefined) picked[key] = data[key];
  }
  return picked;
}

/**
 * Task-driven move body: the requested slot, plus the *persisted* resource with
 * only {@link PLANNER_OWNED_FIELDS} overlaid. Merging onto the snapshot (rather
 * than the request) keeps ECM's fields authoritative — the request blob never
 * clobbers them. Falls back to a slot-only body when the request carries none
 * of those fields, preserving the previous behavior byte-for-byte.
 */
export function buildTaskDrivenMoveBody(
  body: MoveBody,
  snapshot: BookingResponse
): MoveBody {
  const plannerFields = pickPlannerFields(body.resource?.data);
  if (Object.keys(plannerFields).length === 0) return { slot: body.slot };
  const { id, type, label, data } = snapshot.resource;
  return {
    slot: body.slot,
    resource: {
      id,
      ...(type == null ? {} : { type }),
      ...(label == null ? {} : { label }),
      data: { ...data, ...plannerFields },
    },
  };
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
 * Snapshot the pre-move state — the persisted resource blob is the base the
 * planner-owned fields are merged onto (see {@link buildTaskDrivenMoveBody}).
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

  // ECM owns the calendar binding AND the booking's resource payload (the
  // assign chain patches the tuple onto the booking via the async-job
  // ledger), so a move is slot-only apart from the planner-owned fields
  // merged by `buildTaskDrivenMoveBody`. The request body's resource blob is
  // the planner's frozen drag payload — after a workflow revert it can still
  // carry an assignment tuple nobody holds, and merging it wholesale would
  // corrupt the booking. No coordinator binding call: the workflow task
  // moves are what re-sync ECM and the TMS.
  const move = await executeMove(
    client,
    bookingId,
    buildTaskDrivenMoveBody(body.value, snapshot.value)
  );
  if (!move.ok) return move.error;
  return NextResponse.json(move.value);
}
