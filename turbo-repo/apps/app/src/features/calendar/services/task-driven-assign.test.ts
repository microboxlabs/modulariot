/**
 * P3 — task-driven ASSIGN / UNASSIGN helper coverage.
 *
 * Three pure functions:
 *   - `buildAssignProcessVariables` — maps a `SelectedService`-shaped tuple
 *     to the snake_case `processVariables` payload (P0 spike §2.4).
 *   - `decideAssignTaskAdvance` — flag + transition gate for the assign
 *     move (only fires for task-driven origins on the
 *     `assignDriver → presentDriver` transition).
 *   - `getTaskDrivenUnassignTransition` — flag-aware presentDriver →
 *     assignDriver outcome for the unassign move.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildAssignProcessVariables,
  decideAssignTaskAdvance,
  getTaskDrivenUnassignTransition,
} from "./task-driven-assign";

const ENV_KEY = "NEXT_PUBLIC_TASK_DRIVEN_ORIGINS";

const FULL_TUPLE = {
  assignedCarrier: "carrier-uuid",
  assignedDriver: "driver-uuid",
  assignedDriver2: "driver2-uuid",
  assignedTruck: "truck-uuid",
  assignedTrailer: "trailer-uuid",
  assignedCarrierExternalId: "PRVE-001",
  mintral_serviceKind: "Sider",
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
      mintral_serviceKind: "Doble Sider",
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
        mintral_serviceKind: undefined,
      })
    ).toBeNull();
  });
});

describe("decideAssignTaskAdvance — P3 assign flag gating", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("flag ON + assignDriver→presentDriver transition: returns the tuple", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    const vars = decideAssignTaskAdvance(
      "Presentar Conductor",
      "ANTOFAGASTA",
      FULL_TUPLE
    );
    expect(vars).toMatchObject({
      carrier_id: "carrier-uuid",
      driver_id: "driver-uuid",
      truck_id: "truck-uuid",
      tipo_servicio: "SIDER",
    });
  });

  it("flag ON + non-assign transition (PLAN move): returns null", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideAssignTaskAdvance(
        "Asignar Conductor/Transporte",
        "ANTOFAGASTA",
        FULL_TUPLE
      )
    ).toBeNull();
  });

  it("flag OFF: returns null even for the assignDriver→presentDriver transition", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideAssignTaskAdvance("Presentar Conductor", "CALAMA", FULL_TUPLE)
    ).toBeNull();
  });

  it("env unset: every origin is treated as flag-off", () => {
    expect(
      decideAssignTaskAdvance("Presentar Conductor", "ANTOFAGASTA", FULL_TUPLE)
    ).toBeNull();
  });

  it("flag ON + incomplete tuple: returns null (caller falls back to plain GET advance)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      decideAssignTaskAdvance("Presentar Conductor", "ANTOFAGASTA", {
        assignedCarrier: "c",
        assignedDriver: "d",
        // no truck
        mintral_serviceKind: "Sider",
      })
    ).toBeNull();
  });
});

describe("getTaskDrivenUnassignTransition — P3 unassign flag gating", () => {
  const original = process.env[ENV_KEY];

  beforeEach(() => {
    delete process.env[ENV_KEY];
  });

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  it("flag ON + stage=presentDriver: returns the BPMN outcome", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      getTaskDrivenUnassignTransition("presentDriver", "ANTOFAGASTA")
    ).toBe("Asignar Conductor/Transporte");
  });

  it("flag ON + stage=assignDriver: returns undefined (caller uses legacy map)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      getTaskDrivenUnassignTransition("assignDriver", "ANTOFAGASTA")
    ).toBeUndefined();
  });

  it("flag OFF + stage=presentDriver: returns undefined (no change for un-migrated origins)", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      getTaskDrivenUnassignTransition("presentDriver", "CALAMA")
    ).toBeUndefined();
  });

  it("env unset: every origin is treated as flag-off", () => {
    expect(
      getTaskDrivenUnassignTransition("presentDriver", "ANTOFAGASTA")
    ).toBeUndefined();
  });

  it("missing origin: treated as flag-off", () => {
    process.env[ENV_KEY] = "ANTOFAGASTA";
    expect(
      getTaskDrivenUnassignTransition("presentDriver", undefined)
    ).toBeUndefined();
  });
});
