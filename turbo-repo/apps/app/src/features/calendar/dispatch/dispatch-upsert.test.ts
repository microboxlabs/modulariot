import { describe, expect, it } from "vitest";
import {
  buildDispatchUpsert,
  conditionRowsOf,
  dispatchFormProblems,
  type DispatchFormState,
} from "./dispatch-upsert";
import { DISPATCH_EVENT_TYPE } from "./dispatch.types";

const CALENDAR = "31182597-34a1-4039-915b-0e261ebad161";

function state(overrides: Partial<DispatchFormState> = {}): DispatchFormState {
  return {
    connectionId: "conn-1",
    operationId: "op-1",
    scopeCalendarId: null,
    fieldTemplates: {
      service_number: "{{service.code}}",
      driver: "{{resourceData.mintral_driver1Rut}}",
    },
    fieldDefaults: { driver: "00000000-0" },
    successRows: [["response.code", "OK"]],
    retryRows: [],
    enabled: true,
    ...overrides,
  };
}

describe("buildDispatchUpsert", () => {
  it("assembles the full binding body, dropping blank rows", () => {
    const body = buildDispatchUpsert(
      state({
        fieldTemplates: {
          service_number: "{{service.code}}",
          untouched: "   ",
        },
        fieldDefaults: { service_number: "", ghost: "  " },
        successRows: [
          ["response.code", "OK"],
          ["response.", ""],
        ],
        retryRows: [["response.code", "AUTH_RETRY"]],
      })
    );

    expect(body.eventType).toBe(DISPATCH_EVENT_TYPE);
    expect(body.fieldTemplates).toEqual({ service_number: "{{service.code}}" });
    expect(body.fieldDefaults).toEqual({});
    expect(body.responseConditions).toEqual({
      success: { "response.code": "OK" },
      retry: { "response.code": "AUTH_RETRY" },
    });
    expect(body.matchCondition).toEqual({});
    expect(body.responseTemplates).toEqual({});
  });

  it("collapses to no conditions when success is left blank — status-only classification", () => {
    const body = buildDispatchUpsert(
      state({ successRows: [["response.", ""]], retryRows: [] })
    );
    expect(body.responseConditions).toEqual({});
  });

  it("scopes to the calendar only when the operator narrowed it", () => {
    expect(buildDispatchUpsert(state()).scopeKind).toBeNull();
    expect(buildDispatchUpsert(state()).scopeKey).toBeNull();

    const scoped = buildDispatchUpsert(state({ scopeCalendarId: CALENDAR }));
    expect(scoped.scopeKind).toBe("calendar");
    expect(scoped.scopeKey).toBe(CALENDAR);
  });
});

describe("dispatchFormProblems", () => {
  it("accepts the well-formed state", () => {
    expect(dispatchFormProblems(state())).toEqual([]);
  });

  it("flags a stand-in default on a field with no template", () => {
    const problems = dispatchFormProblems(
      state({
        fieldTemplates: { driver: "" },
        fieldDefaults: { driver: "00000000-0" },
      })
    );
    expect(problems).toContainEqual({
      code: "defaultWithoutTemplate",
      fieldId: "driver",
    });
  });

  it("flags condition paths rooted outside response", () => {
    const problems = dispatchFormProblems(
      state({ successRows: [["body.code", "OK"]] })
    );
    expect(problems).toContainEqual({
      code: "conditionPathOutsideResponse",
      path: "body.code",
    });
  });

  it("flags retry rows without a success condition", () => {
    const problems = dispatchFormProblems(
      state({
        successRows: [],
        retryRows: [["response.code", "AUTH_RETRY"]],
      })
    );
    expect(problems).toContainEqual({ code: "retryWithoutSuccess" });
  });

  it("ignores rows and defaults that are still blank", () => {
    const problems = dispatchFormProblems(
      state({
        fieldDefaults: { orphan: "   " },
        successRows: [["response.", ""]],
        retryRows: [["response.", ""]],
      })
    );
    expect(problems).toEqual([]);
  });
});

describe("conditionRowsOf", () => {
  it("round-trips stored conditions into editable rows", () => {
    const rows = conditionRowsOf(
      { success: { "response.code": "OK" }, retry: { "response.status": 202 } },
      "retry"
    );
    expect(rows).toEqual([["response.status", "202"]]);
    expect(conditionRowsOf(undefined, "success")).toEqual([]);
  });
});
