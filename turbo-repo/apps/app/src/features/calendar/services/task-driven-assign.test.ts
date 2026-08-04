/**
 * Task-driven ASSIGN / UNASSIGN helper coverage.
 *
 * Three pure functions:
 *   - `buildAssignProcessVariables` — maps a `SelectedService`-shaped tuple
 *     to the snake_case `processVariables` payload (P0 spike §2.4).
 *   - `decideAssignTaskAdvance` — transition gate for the assign move
 *     (fires only on the `assignDriver → presentDriver` transition).
 *   - `getTaskDrivenUnassignTransition` — presentDriver → assignDriver
 *     outcome for the unassign move.
 *
 * The per-origin TASK_DRIVEN_ORIGINS rollout gate was removed once every
 * origin migrated — the workflow move is the only path.
 */
import { describe, it, expect } from "vitest";
import {
  buildAssignProcessVariables,
  decideAssignTaskAdvance,
  decidePresentedReassign,
  getTaskDrivenUnassignTransition,
} from "./task-driven-assign";

const FULL_TUPLE = {
  assignedCarrier: "carrier-uuid",
  assignedDriver: "driver-uuid",
  assignedDriver2: "driver2-uuid",
  assignedTruck: "truck-uuid",
  assignedTrailer: "trailer-uuid",
  assignedCarrierExternalId: "PRVE-001",
  mintral_serviceType: "Sider",
};

describe("buildAssignProcessVariables", () => {
  it("returns the snake_case tuple with tipo_servicio uppercased", () => {
    expect(buildAssignProcessVariables(FULL_TUPLE)).toEqual({
      carrier_id: "carrier-uuid",
      driver_id: "driver-uuid",
      driver2_id: "driver2-uuid",
      truck_id: "truck-uuid",
      trailer_id: "trailer-uuid",
      carrier_external_id: "PRVE-001",
      tipo_servicio: "SIDER",
    });
  });

  it("nullable fields collapse to JSON null when absent or empty", () => {
    const result = buildAssignProcessVariables({
      assignedCarrier: "c",
      assignedDriver: "d",
      assignedTruck: "t",
      mintral_serviceType: "Doble Sider",
    });
    expect(result).toMatchObject({
      carrier_id: "c",
      driver_id: "d",
      truck_id: "t",
      driver2_id: null,
      trailer_id: null,
      carrier_external_id: null,
      tipo_servicio: "DOBLE SIDER",
    });
  });

  it("explicit null carrier_external_id is preserved as null on the wire", () => {
    const result = buildAssignProcessVariables({
      ...FULL_TUPLE,
      assignedCarrierExternalId: null,
    });
    expect(result?.carrier_external_id).toBeNull();
  });

  it("returns null when any required tuple field is missing", () => {
    expect(
      buildAssignProcessVariables({ ...FULL_TUPLE, assignedCarrier: undefined })
    ).toBeNull();
    expect(
      buildAssignProcessVariables({ ...FULL_TUPLE, assignedDriver: undefined })
    ).toBeNull();
    expect(
      buildAssignProcessVariables({ ...FULL_TUPLE, assignedTruck: undefined })
    ).toBeNull();
    expect(
      buildAssignProcessVariables({
        ...FULL_TUPLE,
        mintral_serviceType: undefined,
      })
    ).toBeNull();
  });
});

describe("decideAssignTaskAdvance — transition gating", () => {
  it("assignDriver→presentDriver transition: returns the tuple", () => {
    const vars = decideAssignTaskAdvance("Presentar Conductor", FULL_TUPLE);
    expect(vars).toMatchObject({
      carrier_id: "carrier-uuid",
      driver_id: "driver-uuid",
      truck_id: "truck-uuid",
      tipo_servicio: "SIDER",
    });
  });

  it("non-assign transition (PLAN move): returns null", () => {
    expect(
      decideAssignTaskAdvance("Asignar Conductor/Transporte", FULL_TUPLE)
    ).toBeNull();
  });

  it("incomplete tuple: returns null (caller falls back to plain GET advance)", () => {
    expect(
      decideAssignTaskAdvance("Presentar Conductor", {
        assignedCarrier: "c",
        assignedDriver: "d",
        // no truck
        mintral_serviceType: "Sider",
      })
    ).toBeNull();
  });
});

describe("decidePresentedReassign — re-push a change on an already-presented service", () => {
  it("stage=presentDriver + full tuple: returns the re-push tuple", () => {
    expect(decidePresentedReassign("presentDriver", FULL_TUPLE)).toMatchObject({
      carrier_id: "carrier-uuid",
      driver_id: "driver-uuid",
      truck_id: "truck-uuid",
      tipo_servicio: "SIDER",
    });
  });

  it("stage=assignDriver (first-time assign): returns null — the forward edge already carries it", () => {
    expect(decidePresentedReassign("assignDriver", FULL_TUPLE)).toBeNull();
  });

  it("stage=planService: returns null", () => {
    expect(decidePresentedReassign("planService", FULL_TUPLE)).toBeNull();
  });

  it("presentDriver but incomplete tuple: returns null (nothing valid to re-push)", () => {
    expect(
      decidePresentedReassign("presentDriver", {
        assignedCarrier: "c",
        assignedDriver: "d",
        mintral_serviceType: "Sider",
      })
    ).toBeNull();
  });
});

describe("getTaskDrivenUnassignTransition — unassign stage gating", () => {
  it("stage=presentDriver: returns the BPMN outcome", () => {
    expect(getTaskDrivenUnassignTransition("presentDriver")).toBe(
      "Asignar Conductor/Transporte"
    );
  });

  it("stage=assignDriver: returns undefined (caller uses the stage map)", () => {
    expect(getTaskDrivenUnassignTransition("assignDriver")).toBeUndefined();
  });
});
