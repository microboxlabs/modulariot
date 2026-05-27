import { describe, it, expect } from "vitest";
import { extractCalendarBindingPayload } from "./binding-extractor";

const CALENDAR_ID = "cal-001";
const SERVICE_CODE = "SVC12345";
const SERVICE_TYPE = "v";
const RESOURCE_ID = `${SERVICE_CODE}-${SERVICE_TYPE}`;
const CARRIER_ID = "11111111-1111-1111-1111-111111111111";
const DRIVER_ID = "22222222-2222-2222-2222-222222222222";
const TRUCK_ID = "33333333-3333-3333-3333-333333333333";
const TRAILER_ID = "44444444-4444-4444-4444-444444444444";
const DRIVER2_ID = "55555555-5555-5555-5555-555555555555";

function assignedBody(overrides: Record<string, unknown> = {}) {
  return {
    calendarId: CALENDAR_ID,
    resource: {
      id: RESOURCE_ID,
      data: {
        mintral_serviceCode: SERVICE_CODE,
        assignedCarrier: CARRIER_ID,
        assignedDriver: DRIVER_ID,
        assignedTruck: TRUCK_ID,
        ...overrides,
      },
    },
  };
}

describe("extractCalendarBindingPayload — carrier_external_id", () => {
  it("populates carrier_external_id from assignedCarrierExternalId when assigned", () => {
    const payload = extractCalendarBindingPayload(
      assignedBody({ assignedCarrierExternalId: "958" })
    );
    expect(payload).not.toBeNull();
    expect(payload?.stage).toBe("assigned");
    expect(payload?.carrier_external_id).toBe("958");
  });

  it("emits carrier_external_id=null when the field is null", () => {
    const payload = extractCalendarBindingPayload(
      assignedBody({ assignedCarrierExternalId: null })
    );
    expect(payload?.stage).toBe("assigned");
    expect(payload?.carrier_external_id).toBeNull();
  });

  it("emits carrier_external_id=null when the field is missing", () => {
    const payload = extractCalendarBindingPayload(assignedBody());
    expect(payload?.stage).toBe("assigned");
    // The key must be present in the wire payload so the backend can
    // distinguish "frontend didn't send" from "frontend sent null"; here
    // both collapse to null per the documented soft-fail policy.
    expect(payload).toHaveProperty("carrier_external_id", null);
  });

  it("emits carrier_external_id=null when the field is a non-string", () => {
    const payload = extractCalendarBindingPayload(
      assignedBody({ assignedCarrierExternalId: 12345 })
    );
    expect(payload?.carrier_external_id).toBeNull();
  });

  it("emits carrier_external_id=null when the field is the empty string", () => {
    const payload = extractCalendarBindingPayload(
      assignedBody({ assignedCarrierExternalId: "" })
    );
    expect(payload?.carrier_external_id).toBeNull();
  });

  it("omits carrier_external_id entirely on planned stage", () => {
    // No carrier/driver/truck triple → stage falls to "planned"; the
    // external_id slot only applies on assigned and must not leak through.
    const payload = extractCalendarBindingPayload({
      calendarId: CALENDAR_ID,
      resource: {
        data: {
          mintral_serviceCode: SERVICE_CODE,
          assignedCarrierExternalId: "958",
        },
      },
    });
    expect(payload?.stage).toBe("planned");
    expect(payload).not.toHaveProperty("carrier_external_id");
  });

  it("omits carrier_external_id when assigned tuple is complete but tipo_servicio is missing", () => {
    // No resource.id suffix AND no mintral_serviceType forces the documented
    // fall-through to stage="planned" — the assigned-only payload slots
    // (including the new external_id) must NOT be set in that case.
    const payload = extractCalendarBindingPayload({
      calendarId: CALENDAR_ID,
      resource: {
        id: SERVICE_CODE, // no `-` suffix → no service-type recoverable
        data: {
          mintral_serviceCode: SERVICE_CODE,
          assignedCarrier: CARRIER_ID,
          assignedDriver: DRIVER_ID,
          assignedTruck: TRUCK_ID,
          assignedCarrierExternalId: "958",
          // mintral_serviceType intentionally absent
        },
      },
    });
    expect(payload?.stage).toBe("planned");
    expect(payload).not.toHaveProperty("carrier_external_id");
  });

  it("populates the full assigned tuple alongside carrier_external_id", () => {
    // Sanity check: the new field travels in the same payload as the
    // existing assigned-stage slots without disturbing them.
    const payload = extractCalendarBindingPayload(
      assignedBody({
        assignedDriver2: DRIVER2_ID,
        assignedTrailer: TRAILER_ID,
        assignedCarrierExternalId: "958",
      })
    );
    expect(payload).toMatchObject({
      stage: "assigned",
      numero_servicio: SERVICE_CODE,
      calendar_id: CALENDAR_ID,
      tipo_servicio: SERVICE_TYPE.toUpperCase(),
      carrier_id: CARRIER_ID,
      driver_id: DRIVER_ID,
      driver2_id: DRIVER2_ID,
      truck_id: TRUCK_ID,
      trailer_id: TRAILER_ID,
      carrier_external_id: "958",
    });
  });

  it("falls back to mintral_serviceType when resource.id has no `-` suffix", () => {
    // Legacy/odd ids without the `${serviceCode}-${serviceType}` shape:
    // the explicit field on the resource data is the documented fallback.
    const payload = extractCalendarBindingPayload({
      calendarId: CALENDAR_ID,
      resource: {
        id: SERVICE_CODE,
        data: {
          mintral_serviceCode: SERVICE_CODE,
          mintral_serviceType: SERVICE_TYPE,
          assignedCarrier: CARRIER_ID,
          assignedDriver: DRIVER_ID,
          assignedTruck: TRUCK_ID,
        },
      },
    });
    expect(payload?.stage).toBe("assigned");
    expect(payload?.tipo_servicio).toBe(SERVICE_TYPE.toUpperCase());
  });
});
