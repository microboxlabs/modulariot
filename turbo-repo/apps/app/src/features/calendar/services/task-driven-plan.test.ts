/**
 * Task-driven PLAN helper coverage — pairs with `task-driven-assign.test.ts`.
 *
 * Two pure functions:
 *   - `buildPlanProcessVariables` — assembles the slot tuple (calendar_id +
 *     slot_date/hour/minutes as strings) the ECM `OnCreateAssignDriverBinding`
 *     listener consumes to write the `cld_bookings` row.
 *   - `decidePlanTaskAdvance` — flag + transition gate for the plan move
 *     (only fires for task-driven origins on the
 *     `planService → assignDriver` outcome, `Asignar Conductor/Transporte`).
 *
 * Presence of these vars on the task move is the FE signal to SKIP the BFF
 * `POST /app/api/calendar/bookings` write — verified at the call site in
 * `planning-selection-context.tsx` via `isTaskDrivenPlanCreate`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildPlanProcessVariables,
  decidePlanTaskAdvance,
} from "./task-driven-plan";

const ENV_KEY = "NEXT_PUBLIC_TASK_DRIVEN_ORIGINS";
const CAL = "4b929627-35a8-4371-9cf1-065bcd6867f0";

describe("buildPlanProcessVariables", () => {
  it("formats the slot tuple as strings with YYYY-MM-DD (local) date", () => {
    // Local-TZ constructor so the formatted date stays 2026-05-27 in every
    // CI timezone — mirrors the planner's own `buildBookingRequest` shape
    // (`dayjs(slot.date).format("YYYY-MM-DD")` against a local-time Date).
    expect(
      buildPlanProcessVariables(CAL, {
        date: new Date(2026, 4, 27, 9, 15),
        hour: 9,
        minutes: 15,
      })
    ).toEqual({
      calendar_id: CAL,
      slot_date: "2026-05-27",
      slot_hour: "9",
      slot_minutes: "15",
    });
  });

  it("accepts a YYYY-MM-DD string date verbatim", () => {
    const vars = buildPlanProcessVariables(CAL, {
      date: "2026-05-27",
      hour: 0,
      minutes: 0,
    });
    expect(vars).toEqual({
      calendar_id: CAL,
      slot_date: "2026-05-27",
      slot_hour: "0",
      slot_minutes: "0",
    });
  });

  it("returns null when calendarId is missing", () => {
    expect(
      buildPlanProcessVariables(undefined, {
        date: new Date(),
        hour: 9,
        minutes: 15,
      })
    ).toBeNull();
  });
});

describe("decidePlanTaskAdvance — plan-side flag gating", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  const slot = { date: new Date(2026, 4, 27, 9, 15), hour: 9, minutes: 15 };

  it("flag ON + planService→assignDriver transition: returns the tuple", () => {
    process.env[ENV_KEY] = "SCL";
    expect(
      decidePlanTaskAdvance("Asignar Conductor/Transporte", "SCL", CAL, slot)
    ).toEqual({
      calendar_id: CAL,
      slot_date: "2026-05-27",
      slot_hour: "9",
      slot_minutes: "15",
    });
  });

  it("flag ON + non-plan transition (ASSIGN move): returns null", () => {
    process.env[ENV_KEY] = "SCL";
    expect(
      decidePlanTaskAdvance("Presentar Conductor", "SCL", CAL, slot)
    ).toBeNull();
  });

  it("flag OFF: returns null even on the plan transition", () => {
    process.env[ENV_KEY] = "SCL";
    expect(
      decidePlanTaskAdvance(
        "Asignar Conductor/Transporte",
        "ANTOFAGASTA",
        CAL,
        slot
      )
    ).toBeNull();
  });

  it("env unset: every origin is treated as flag-off", () => {
    expect(
      decidePlanTaskAdvance("Asignar Conductor/Transporte", "SCL", CAL, slot)
    ).toBeNull();
  });

  it("flag ON + missing calendarId: returns null", () => {
    process.env[ENV_KEY] = "SCL";
    expect(
      decidePlanTaskAdvance(
        "Asignar Conductor/Transporte",
        "SCL",
        undefined,
        slot
      )
    ).toBeNull();
  });

  it("flag ON + missing origin: returns null", () => {
    process.env[ENV_KEY] = "SCL";
    expect(
      decidePlanTaskAdvance(
        "Asignar Conductor/Transporte",
        undefined,
        CAL,
        slot
      )
    ).toBeNull();
  });
});
