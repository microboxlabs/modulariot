/**
 * Move-path flag gating tests for the bookings move BFF.
 *
 * When the per-origin task-driven flag is ON for the booking's origin, the
 * move is forwarded slot-only (the planner's frozen resource blob is never
 * merged onto the booking) and the ECM `/mintral/calendar/binding` call —
 * with its reverse-move compensation — is skipped entirely: ECM owns both
 * the binding and the booking payload via the async-job ledger. When the
 * flag is OFF, the route's behavior is byte-for-byte unchanged: full-body
 * move, binding call derived from the moved booking, reverse-move
 * compensation on binding failure.
 *
 * Heavy collaborators (auth, miot-calendar client, the binding helper) are
 * mocked at the module level so the test stays focused on the gating
 * decision; the helpers themselves are exercised by their own unit tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEY = "TASK_DRIVEN_ORIGINS";
const ORIGINAL_ENV = process.env[ENV_KEY];

const requireAnyGroupMock = vi.fn();
const runCalendarBindingMock = vi.fn();
const createMiotCalendarClientMock = vi.fn();
const bookingsGetMock = vi.fn();
const bookingsMoveMock = vi.fn();

vi.mock("../../../../utils/alfresco-crud-client", () => ({
  requireAnyGroup: (...args: unknown[]) => requireAnyGroupMock(...args),
}));

vi.mock("../../binding-helpers", () => ({
  runCalendarBinding: (...args: unknown[]) => runCalendarBindingMock(...args),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

class MiotCalendarApiErrorStub extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

vi.mock("@microboxlabs/miot-calendar-client", () => ({
  createMiotCalendarClient: (...args: unknown[]) =>
    createMiotCalendarClientMock(...args),
  MiotCalendarApiError: MiotCalendarApiErrorStub,
}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const TASK_DRIVEN_ORIGIN = "ANF";
const LEGACY_ORIGIN = "SCL";
const BOOKING_ID = "bk-001";

const ASSIGNMENT_TUPLE = {
  assignedCarrier: "carrier-uuid",
  assignedDriver: "driver-uuid",
  assignedTruck: "truck-uuid",
  assignedCarrierExternalId: "21",
};

function makeBooking(
  origen: string | undefined,
  data: Record<string, unknown> = {}
) {
  return {
    id: BOOKING_ID,
    calendarId: "cal-001",
    resource: {
      id: "1586586-V",
      type: "service",
      label: "1586586-V",
      data: {
        mintral_serviceCode: "1586586",
        ...(origen ? { origen } : {}),
        ...data,
      },
    },
    slot: { date: "2026-06-01", hour: 9, minutes: 0 },
    createdAt: "2026-06-01T00:00:00Z",
  };
}

function makeMoveRequest(body: Record<string, unknown>) {
  return new Request(
    `http://localhost/api/calendar/bookings/${BOOKING_ID}/move`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function makeMoveBody(origen: string, data: Record<string, unknown> = {}) {
  return {
    slot: { date: "2026-06-02", hour: 5, minutes: 0 },
    resource: {
      id: "1586586-V",
      type: "service",
      label: "1586586-V",
      data: {
        mintral_serviceCode: "1586586",
        origen,
        ...data,
      },
    },
  };
}

const routeParams = { params: Promise.resolve({ bookingId: BOOKING_ID }) };

describe("bookings move POST — task-driven flag gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAnyGroupMock.mockResolvedValue({
      authorized: true,
      session: { user: { rawJWT: "jwt" } },
    });
    createMiotCalendarClientMock.mockReturnValue({
      bookings: {
        get: bookingsGetMock,
        move: bookingsMoveMock,
      },
    });
    runCalendarBindingMock.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = ORIGINAL_ENV;
    }
  });

  it("flag OFF: forwards the full body and fires the assigned-stage binding", async () => {
    delete process.env[ENV_KEY];
    const snapshot = makeBooking(LEGACY_ORIGIN);
    const body = makeMoveBody(LEGACY_ORIGIN, ASSIGNMENT_TUPLE);
    const moved = makeBooking(LEGACY_ORIGIN, ASSIGNMENT_TUPLE);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(moved);

    const { POST } = await loadRoute();
    const response = await POST(makeMoveRequest(body), routeParams);

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, body);
    expect(runCalendarBindingMock).toHaveBeenCalledTimes(1);
    const [, payload] = runCalendarBindingMock.mock.calls[0];
    expect(payload).toMatchObject({
      numero_servicio: "1586586",
      stage: "assigned",
      carrier_id: "carrier-uuid",
    });
  });

  it("flag OFF: reverses the move when the binding call fails", async () => {
    delete process.env[ENV_KEY];
    const snapshot = makeBooking(LEGACY_ORIGIN);
    const body = makeMoveBody(LEGACY_ORIGIN, ASSIGNMENT_TUPLE);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(LEGACY_ORIGIN, ASSIGNMENT_TUPLE));
    runCalendarBindingMock.mockResolvedValue({
      ok: false,
      status: 502,
      message: "Alerce push failed",
    });

    const { POST } = await loadRoute();
    const response = await POST(makeMoveRequest(body), routeParams);

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      calendarBindingFailed: true,
      bookingCompensated: true,
    });
    // Second move call is the compensation, restoring the snapshot state.
    expect(bookingsMoveMock).toHaveBeenCalledTimes(2);
    expect(bookingsMoveMock).toHaveBeenLastCalledWith(BOOKING_ID, {
      slot: snapshot.slot,
      resource: snapshot.resource,
    });
  });

  it("flag ON: forwards a slot-only move and never calls the binding", async () => {
    process.env[ENV_KEY] = TASK_DRIVEN_ORIGIN;
    const snapshot = makeBooking(TASK_DRIVEN_ORIGIN);
    // The drag payload still carries a (possibly stale) assignment tuple —
    // it must not reach the calendar service nor trigger an Alerce push.
    const body = makeMoveBody(TASK_DRIVEN_ORIGIN, ASSIGNMENT_TUPLE);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(TASK_DRIVEN_ORIGIN));

    const { POST } = await loadRoute();
    const response = await POST(makeMoveRequest(body), routeParams);

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledTimes(1);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, {
      slot: body.slot,
    });
    expect(runCalendarBindingMock).not.toHaveBeenCalled();
  });

  it("flag ON: reads the origin from the persisted booking when the body has none", async () => {
    process.env[ENV_KEY] = TASK_DRIVEN_ORIGIN;
    const snapshot = makeBooking(TASK_DRIVEN_ORIGIN);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(TASK_DRIVEN_ORIGIN));

    const { POST } = await loadRoute();
    const response = await POST(
      makeMoveRequest({ slot: { date: "2026-06-02", hour: 5, minutes: 0 } }),
      routeParams
    );

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, {
      slot: { date: "2026-06-02", hour: 5, minutes: 0 },
    });
    expect(runCalendarBindingMock).not.toHaveBeenCalled();
  });

  it("flag ON for a different origin: the legacy path still runs", async () => {
    process.env[ENV_KEY] = TASK_DRIVEN_ORIGIN;
    const snapshot = makeBooking(LEGACY_ORIGIN);
    const body = makeMoveBody(LEGACY_ORIGIN, ASSIGNMENT_TUPLE);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(LEGACY_ORIGIN, ASSIGNMENT_TUPLE));

    const { POST } = await loadRoute();
    const response = await POST(makeMoveRequest(body), routeParams);

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, body);
    expect(runCalendarBindingMock).toHaveBeenCalledTimes(1);
  });
});
