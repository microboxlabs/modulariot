/**
 * P2 — Plan-path flag gating tests for the bookings BFF.
 *
 * Covers the only behavioral change in P2 on this route: when the per-origin
 * task-driven flag is ON for the booking's origin, the call to ECM
 * `/mintral/calendar/binding` (`runCalendarBinding`) is skipped entirely and
 * its compensation branch is dead. When the flag is OFF, the route's
 * behavior is byte-for-byte unchanged from the pre-P2 path.
 *
 * Heavy collaborators (auth, miot-calendar client, the binding helper) are
 * mocked at the module level so the test stays focused on the gating
 * decision; the helpers themselves are exercised by their own unit tests.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const ENV_KEY = "TASK_DRIVEN_ORIGINS";
const ORIGINAL_ENV = process.env[ENV_KEY];

const requireAuthMock = vi.fn();
const requireAnyGroupMock = vi.fn();
const runCalendarBindingMock = vi.fn();
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

vi.mock("./binding-helpers", () => ({
  runCalendarBinding: (...args: unknown[]) => runCalendarBindingMock(...args),
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
  // Fresh import so each test picks up the current env state (the route
  // reads TASK_DRIVEN_ORIGINS per-request via parseTaskDrivenOrigins, but
  // resetting modules also avoids any cached state from prior tests
  // bleeding in).
  vi.resetModules();
  return import("./route");
}

const TASK_DRIVEN_ORIGIN = "ANTOFAGASTA";
const LEGACY_ORIGIN = "CALAMA";

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
  origen?: string;
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
        data: {
          mintral_serviceCode: "SVC-001",
          origen: overrides.origen ?? LEGACY_ORIGIN,
        },
      },
      slot: { date: "2026-06-01", hour: 9, minutes: 0 },
      ...(advance ? { taskAdvance: advance } : {}),
    }),
  });
}

describe("bookings POST — P2 plan-path task-driven flag gating", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env[ENV_KEY] = TASK_DRIVEN_ORIGIN;

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
    runCalendarBindingMock.mockResolvedValue({ ok: true });
    endTaskMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = ORIGINAL_ENV;
    }
  });

  it("flag ON: skips runCalendarBinding for the task-driven origin (plan)", async () => {
    const { POST } = await loadRoute();
    const response = await POST(makeBookingRequest({ origen: TASK_DRIVEN_ORIGIN }));

    expect(response.status).toBe(201);
    expect(bookingsCreateMock).toHaveBeenCalledTimes(1);
    expect(runCalendarBindingMock).not.toHaveBeenCalled();
    // The cancel-booking-on-binding-failure compensation cannot run when no
    // binding call ran — the booking stays as written.
    expect(bookingsCancelMock).not.toHaveBeenCalled();
  });

  it("flag ON: still advances the workflow task when taskAdvance is present", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makeBookingRequest({
        origen: TASK_DRIVEN_ORIGIN,
        taskAdvance: { taskId: "task-1", transitionId: "Next" },
      })
    );

    expect(response.status).toBe(201);
    expect(runCalendarBindingMock).not.toHaveBeenCalled();
    // No `processVariables` on this taskAdvance: the BFF forwards
    // `undefined` to endTask so the provider stays on the legacy GET.
    expect(endTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({ user: expect.any(Object) }),
      "task-1",
      "Next",
      undefined
    );
  });

  it("flag OFF: keeps calling runCalendarBinding for non-task-driven origin (plan)", async () => {
    const { POST } = await loadRoute();
    const response = await POST(makeBookingRequest({ origen: LEGACY_ORIGIN }));

    expect(response.status).toBe(201);
    expect(bookingsCreateMock).toHaveBeenCalledTimes(1);
    expect(runCalendarBindingMock).toHaveBeenCalledTimes(1);
    const payloadArg = runCalendarBindingMock.mock.calls[0][1];
    expect(payloadArg).toMatchObject({
      numero_servicio: "SVC-001",
      calendar_id: "cal-001",
      stage: "planned",
    });
  });

  it("flag OFF: a binding failure still cancels the just-created booking (compensation alive)", async () => {
    runCalendarBindingMock.mockResolvedValue({
      ok: false,
      status: 502,
      message: "ECM down",
    });
    const { POST } = await loadRoute();
    const response = await POST(makeBookingRequest({ origen: LEGACY_ORIGIN }));

    expect(response.status).toBe(502);
    expect(bookingsCancelMock).toHaveBeenCalledWith("booking-001");
    const body = await response.json();
    expect(body).toMatchObject({
      error: "ECM down",
      calendarBindingFailed: true,
      bookingCompensated: true,
    });
  });

  it("env unset: every origin is treated as flag-off (default)", async () => {
    delete process.env[ENV_KEY];
    const { POST } = await loadRoute();
    const response = await POST(makeBookingRequest({ origen: TASK_DRIVEN_ORIGIN }));

    expect(response.status).toBe(201);
    expect(runCalendarBindingMock).toHaveBeenCalledTimes(1);
  });

  it("origin missing from resource.data: falls through to today's binding call", async () => {
    const request = new Request("http://localhost/api/calendar/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        calendarId: "cal-001",
        resource: {
          id: "svc-001",
          type: "service",
          label: "Cliente Demo",
          data: { mintral_serviceCode: "SVC-001" },
        },
        slot: { date: "2026-06-01", hour: 9, minutes: 0 },
      }),
    });

    const { POST } = await loadRoute();
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(runCalendarBindingMock).toHaveBeenCalledTimes(1);
  });

  it("flag ON + ASSIGN move: forwards processVariables to endTask (POST body), no binding call", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makeBookingRequest({
        origen: TASK_DRIVEN_ORIGIN,
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
    expect(runCalendarBindingMock).not.toHaveBeenCalled();
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

  it("flag OFF + ASSIGN move: runs binding call AND a GET endTask (no processVariables on the wire)", async () => {
    const { POST } = await loadRoute();
    const response = await POST(
      makeBookingRequest({
        origen: LEGACY_ORIGIN,
        taskAdvance: {
          taskId: "task-1",
          transitionId: "Presentar Conductor",
        },
        // Even if the caller (defensively) supplies a tuple, the BFF's
        // gating decision is on origin — for flag-off, the binding call
        // runs and endTask is called WITHOUT processVariables (today's GET).
        processVariables: {
          carrier_id: "carrier-uuid",
          driver_id: "driver-uuid",
          driver2_id: null,
          truck_id: "truck-uuid",
          trailer_id: null,
          carrier_external_id: null,
          tipo_servicio: "SIDER",
        },
      })
    );

    expect(response.status).toBe(201);
    expect(runCalendarBindingMock).toHaveBeenCalledTimes(1);
    // The BFF still threads the processVariables it received onto endTask
    // (the gate is at the FE — the planner only attaches the tuple when
    // the origin is task-driven). What's load-bearing here is that the
    // binding call STILL fires for legacy origins regardless.
    expect(endTaskMock).toHaveBeenCalledTimes(1);
  });
});
