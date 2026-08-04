/**
 * Bookings move BFF: every move is slot-only apart from the planner-owned
 * fields (serviceCategory, _anden) merged onto the PERSISTED resource — ECM
 * owns the binding and the booking payload via the async-job ledger, so the
 * legacy full-body move, its `/mintral/calendar/binding` call and the
 * reverse-move compensation are gone (removed with the ORIGINS
 * rollout flag once every origin migrated).
 *
 * Heavy collaborators (auth, miot-calendar client) are mocked at the module
 * level so the test stays focused on the route's own behavior.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";


const requireAnyGroupMock = vi.fn();
const createMiotCalendarClientMock = vi.fn();
const bookingsGetMock = vi.fn();
const bookingsMoveMock = vi.fn();

vi.mock("../../../../utils/alfresco-crud-client", () => ({
  requireAnyGroup: (...args: unknown[]) => requireAnyGroupMock(...args),
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

const ORIGIN = "ANF";
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

describe("bookings move POST — slot-only with planner-owned overlays", () => {
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
  });


  it("forwards a slot-only move (stale drag tuple never reaches the calendar)", async () => {
    const snapshot = makeBooking(ORIGIN);
    // The drag payload still carries a (possibly stale) assignment tuple —
    // it must not reach the calendar service nor trigger a TMS push.
    const body = makeMoveBody(ORIGIN, ASSIGNMENT_TUPLE);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(ORIGIN));

    const { POST } = await loadRoute();
    const response = await POST(makeMoveRequest(body), routeParams);

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledTimes(1);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, {
      slot: body.slot,
    });
  });

  // Regression: a task-driven move used to drop the resource blob wholesale, so
  // the planner's category/andén were written nowhere — ECM never writes them,
  // and the grid renders from the booking row — and silently vanished on the
  // next page load. They now ride the move, merged onto the PERSISTED resource
  // so ECM's fields stay authoritative and no `assigned*` field ever leaks.
  it("merges serviceCategory onto the persisted resource, dropping the tuple", async () => {
    const snapshot = makeBooking(ORIGIN, {
      mintral_serviceKind: "rampla",
    });
    const body = makeMoveBody(ORIGIN, {
      ...ASSIGNMENT_TUPLE,
      serviceCategory: "DIRECT_PICKUP",
    });
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(ORIGIN));

    const { POST } = await loadRoute();
    const response = await POST(makeMoveRequest(body), routeParams);

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, {
      slot: body.slot,
      resource: {
        id: snapshot.resource.id,
        type: snapshot.resource.type,
        label: snapshot.resource.label,
        data: {
          // ECM-owned fields survive untouched...
          mintral_serviceCode: "1586586",
          origen: ORIGIN,
          mintral_serviceKind: "rampla",
          // ...and the planner's choice now persists.
          serviceCategory: "DIRECT_PICKUP",
        },
      },
    });
    // The stale tuple must never reach the calendar service.
    const [, forwarded] = bookingsMoveMock.mock.calls[0];
    expect(forwarded.resource.data).not.toHaveProperty("assignedCarrier");
    expect(forwarded.resource.data).not.toHaveProperty("assignedDriver");
    expect(forwarded.resource.data).not.toHaveProperty("assignedTruck");
  });

  it("merges the andén (_anden) the same way", async () => {
    const snapshot = makeBooking(ORIGIN);
    const body = makeMoveBody(ORIGIN, { _anden: 1 });
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(ORIGIN));

    const { POST } = await loadRoute();
    await POST(makeMoveRequest(body), routeParams);

    const [, forwarded] = bookingsMoveMock.mock.calls[0];
    expect(forwarded.resource.data).toMatchObject({
      _anden: 1,
      mintral_serviceCode: "1586586",
    });
  });

  it("a request field that is not planner-owned is still dropped", async () => {
    const snapshot = makeBooking(ORIGIN);
    const body = makeMoveBody(ORIGIN, {
      serviceCategory: "DIRECT_PICKUP",
      destino: "TAMPERED",
    });
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(ORIGIN));

    const { POST } = await loadRoute();
    await POST(makeMoveRequest(body), routeParams);

    const [, forwarded] = bookingsMoveMock.mock.calls[0];
    expect(forwarded.resource.data.serviceCategory).toBe("DIRECT_PICKUP");
    expect(forwarded.resource.data).not.toHaveProperty("destino");
  });

  it("a body with no resource blob moves slot-only", async () => {
    const snapshot = makeBooking(ORIGIN);
    bookingsGetMock.mockResolvedValue(snapshot);
    bookingsMoveMock.mockResolvedValue(makeBooking(ORIGIN));

    const { POST } = await loadRoute();
    const response = await POST(
      makeMoveRequest({ slot: { date: "2026-06-02", hour: 5, minutes: 0 } }),
      routeParams
    );

    expect(response.status).toBe(200);
    expect(bookingsMoveMock).toHaveBeenCalledWith(BOOKING_ID, {
      slot: { date: "2026-06-02", hour: 5, minutes: 0 },
    });
  });

});
