/**
 * Bookings BFF: the route never notifies ECM synchronously. The legacy
 * `/mintral/calendar/binding` call (`runCalendarBinding`) and its
 * cancel-booking compensation were removed with the TASK_DRIVEN_ORIGINS
 * rollout flag once every origin migrated — ECM's task listeners reconcile
 * the binding, and the TMS push rides the modulith job ledger, off the
 * workflow task move alone.
 *
 * Heavy collaborators (auth, miot-calendar client, endTask) are mocked at
 * the module level so the test stays focused on the route's own behavior.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const requireAuthMock = vi.fn();
const requireAnyGroupMock = vi.fn();
const endTaskMock = vi.fn();
const createMiotCalendarClientMock = vi.fn();
const bookingsCreateMock = vi.fn();
const bookingsListByResourceMock = vi.fn();
const bookingsCancelMock = vi.fn();
const bookingsListMock = vi.fn();

vi.mock("../../utils/alfresco-crud-client", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
  requireAnyGroup: (...args: unknown[]) => requireAnyGroupMock(...args),
}));

vi.mock("@/features/common/providers/alfresco-api/alfresco-api.provider", () => ({
  endTask: (...args: unknown[]) => endTaskMock(...args),
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

type WireProcessVariables = {
  carrier_id: string;
  driver_id: string;
  driver2_id: string | null;
  truck_id: string;
  trailer_id: string | null;
  carrier_external_id: string | null;
  tipo_servicio: string;
};

function makeBookingRequest(overrides: {
  taskAdvance?: { taskId: string; transitionId: string };
  processVariables?: WireProcessVariables;
}) {
  const advance = overrides.taskAdvance
    ? {
        ...overrides.taskAdvance,
        ...(overrides.processVariables
          ? { processVariables: overrides.processVariables }
          : {}),
      }
    : undefined;
  return new Request("http://localhost/api/calendar/bookings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      calendarId: "cal-001",
      resource: {
        id: "svc-001",
        type: "service",
        label: "Cliente Demo",
        data: { mintral_serviceCode: "SVC-001", origen: "ANTOFAGASTA" },
      },
      slot: { date: "2026-06-01", hour: 9, minutes: 0 },
      ...(advance ? { taskAdvance: advance } : {}),
    }),
  });
}

describe("bookings POST — task-driven only (no synchronous binding call)", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireAnyGroupMock.mockResolvedValue({
      authorized: true,
      session: { user: { email: "u@example.com", rawJWT: "jwt" } },
      userGroups: ["GROUP_PLANNING"],
    });

    bookingsCreateMock.mockResolvedValue({ id: "booking-001" });
    bookingsListByResourceMock.mockResolvedValue({ data: [] });
    bookingsCancelMock.mockResolvedValue(undefined);
    bookingsListMock.mockResolvedValue({ data: [] });
    createMiotCalendarClientMock.mockReturnValue({
      bookings: {
        create: bookingsCreateMock,
        listByResource: bookingsListByResourceMock,
        cancel: bookingsCancelMock,
        list: bookingsListMock,
      },
    });
    endTaskMock.mockResolvedValue(undefined);
  });

  it("creates the booking with no coordinator notification and no compensation", async () => {
    const { POST } = await loadRoute();
    const response = await POST(makeBookingRequest({}));

    expect(response.status).toBe(201);
    expect(bookingsCreateMock).toHaveBeenCalledTimes(1);
    // No binding call exists any more, so no cancel-on-binding-failure either.
    expect(bookingsCancelMock).not.toHaveBeenCalled();
  });

  it("advances the workflow task when taskAdvance is present", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makeBookingRequest({
        taskAdvance: { taskId: "task-1", transitionId: "Next" },
      })
    );

    expect(response.status).toBe(201);
    // No `processVariables` on this taskAdvance: the BFF forwards
    // `undefined` to endTask so the provider stays on the legacy GET.
    expect(endTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      "task-1",
      "Next",
      undefined
    );
  });

  it("ASSIGN move: forwards processVariables to endTask (POST body)", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makeBookingRequest({
        taskAdvance: {
          taskId: "task-1",
          transitionId: "Presentar Conductor",
        },
        processVariables: {
          carrier_id: "carrier-uuid",
          driver_id: "driver-uuid",
          driver2_id: null,
          truck_id: "truck-uuid",
          trailer_id: null,
          carrier_external_id: "PRVE-001",
          tipo_servicio: "SIDER",
        },
      })
    );

    expect(response.status).toBe(201);
    expect(endTaskMock).toHaveBeenCalledTimes(1);
    expect(endTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      "task-1",
      "Presentar Conductor",
      {
        carrier_id: "carrier-uuid",
        driver_id: "driver-uuid",
        driver2_id: null,
        truck_id: "truck-uuid",
        trailer_id: null,
        carrier_external_id: "PRVE-001",
        tipo_servicio: "SIDER",
      }
    );
  });

  it("a failed task advance still compensates the just-created booking", async () => {
    endTaskMock.mockRejectedValue(new Error("workflow down"));
    const { POST } = await loadRoute();
    const response = await POST(
      makeBookingRequest({
        taskAdvance: { taskId: "task-1", transitionId: "Next" },
      })
    );

    expect(response.status).toBe(502);
    expect(bookingsCancelMock).toHaveBeenCalledWith("booking-001");
    const body = await response.json();
    expect(body).toMatchObject({
      taskAdvanceFailed: true,
      bookingCompensated: true,
    });
  });
});
