/**
 * Task-driven PLAN helper coverage — pairs with `task-driven-assign.test.ts`.
 *
 * Two pure functions:
 *   - `buildPlanProcessVariables` — assembles the slot tuple (calendar_id +
 *     slot_date/hour/minutes as strings) the ECM `OnCreateAssignDriverBinding`
 *     listener consumes to write the `cld_bookings` row.
 *   - `decidePlanTaskAdvance` — transition gate for the plan move (fires
 *     only on the `planService → assignDriver` outcome,
 *     `Asignar Conductor/Transporte`).
 *
 * Presence of these vars on the task move is the FE signal to SKIP the BFF
 * `POST /app/api/calendar/bookings` write — verified at the call site in
 * `planning-selection-context.tsx` via `isTaskDrivenPlanCreate`.
 */
import { describe, it, expect } from "vitest";
import {
  buildPlanProcessVariables,
  decidePlanTaskAdvance,
} from "./task-driven-plan";

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

  it("includes mintral_serviceCategory when provided", () => {
    const vars = buildPlanProcessVariables(
      CAL,
      { date: new Date(2026, 4, 27, 9, 15), hour: 9, minutes: 15 },
      "TRUNK_SUPPLY"
    );
    expect(vars).toEqual({
      calendar_id: CAL,
      slot_date: "2026-05-27",
      slot_hour: "9",
      slot_minutes: "15",
      mintral_serviceCategory: "TRUNK_SUPPLY",
    });
  });

  it("omits mintral_serviceCategory when blank or undefined", () => {
    const blank = buildPlanProcessVariables(
      CAL,
      { date: new Date(2026, 4, 27, 9, 15), hour: 9, minutes: 15 },
      ""
    );
    expect(blank).not.toHaveProperty("mintral_serviceCategory");
    const undef = buildPlanProcessVariables(
      CAL,
      { date: new Date(2026, 4, 27, 9, 15), hour: 9, minutes: 15 },
      undefined
    );
    expect(undef).not.toHaveProperty("mintral_serviceCategory");
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

describe("decidePlanTaskAdvance — transition gating", () => {
  const slot = { date: new Date(2026, 4, 27, 9, 15), hour: 9, minutes: 15 };

  it("planService→assignDriver transition: returns the tuple", () => {
    expect(
      decidePlanTaskAdvance("Asignar Conductor/Transporte", CAL, slot)
    ).toEqual({
      calendar_id: CAL,
      slot_date: "2026-05-27",
      slot_hour: "9",
      slot_minutes: "15",
    });
  });

  it("serviceCategory: includes mintral_serviceCategory in the tuple", () => {
    expect(
      decidePlanTaskAdvance(
        "Asignar Conductor/Transporte",
        CAL,
        slot,
        "TRUNK_SUPPLY"
      )
    ).toEqual({
      calendar_id: CAL,
      slot_date: "2026-05-27",
      slot_hour: "9",
      slot_minutes: "15",
      mintral_serviceCategory: "TRUNK_SUPPLY",
    });
  });

  it("non-plan transition (ASSIGN move): returns null", () => {
    expect(
      decidePlanTaskAdvance("Presentar Conductor", CAL, slot)
    ).toBeNull();
  });

  it("missing calendarId: returns null", () => {
    expect(
      decidePlanTaskAdvance("Asignar Conductor/Transporte", undefined, slot)
    ).toBeNull();
  });
});
