import { describe, it, expect } from "vitest";
import type { BookingResponse } from "@microboxlabs/miot-calendar-client";
import { mapBookingToPlannedService } from "./booking-service-mapper";

function booking(overrides: Partial<BookingResponse> = {}): BookingResponse {
  return {
    id: "booking-1",
    calendarId: "cal-A",
    resource: {
      id: "1658427-V",
      type: "service",
      data: {
        mintral_serviceCode: "1658427",
        origen: "ANF",
        destino: "SPC",
      },
    },
    slot: { date: "2026-07-13", hour: 5, minutes: 0 },
    createdAt: "2026-07-12T15:16:30Z",
    ...overrides,
  } as BookingResponse;
}

describe("mapBookingToPlannedService — workflowStage from booking status", () => {
  it("leaves workflowStage unset when the row carries no status (legacy servers)", () => {
    const mapped = mapBookingToPlannedService(booking());
    expect(mapped?.planned.workflowStage).toBeUndefined();
  });

  it("maps FINISHED to the terminal 'finished' stage", () => {
    const mapped = mapBookingToPlannedService(booking({ status: "FINISHED" }));
    expect(mapped?.planned.workflowStage).toBe("finished");
  });

  it("returns null for CANCELLED bookings — history rows neither the grid nor the search may surface", () => {
    expect(mapBookingToPlannedService(booking({ status: "CANCELLED" }))).toBeNull();
  });

  it("leaves planning-segment statuses unset (the live index owns them)", () => {
    const mapped = mapBookingToPlannedService(booking({ status: "PLANNED" }));
    expect(mapped?.planned.workflowStage).toBeUndefined();
  });

  it("still maps the service payload and slot as before", () => {
    const mapped = mapBookingToPlannedService(booking({ status: "FINISHED" }));
    expect(mapped?.bookingId).toBe("booking-1");
    expect(mapped?.planned.service.mintral_serviceCode).toBe("1658427");
    expect(mapped?.planned.service.origen).toBe("ANF");
    expect(mapped?.planned.slot.hour).toBe(5);
  });

  it("returns null for slotless bookings regardless of status", () => {
    const slotless = booking({ status: "FINISHED" });
    // @ts-expect-error — exercising the runtime guard for a missing slot
    slotless.slot = undefined;
    expect(mapBookingToPlannedService(slotless)).toBeNull();
  });
});

describe("mapBookingToPlannedService — sync status", () => {
  it("leaves syncStatus unset for untracked bookings (no external mirror)", () => {
    const mapped = mapBookingToPlannedService(booking());
    expect(mapped?.planned.syncStatus).toBeUndefined();
    expect(mapped?.planned.syncDetail).toBeUndefined();
  });

  it("carries CONFIRMED through the map", () => {
    const mapped = mapBookingToPlannedService(booking({ syncStatus: "CONFIRMED" }));
    expect(mapped?.planned.syncStatus).toBe("CONFIRMED");
  });

  it("carries REJECTED and its detail through the map", () => {
    const mapped = mapBookingToPlannedService(
      booking({ syncStatus: "REJECTED", syncDetail: "CONDUCTOR2 NO EXISTE" })
    );
    expect(mapped?.planned.syncStatus).toBe("REJECTED");
    expect(mapped?.planned.syncDetail).toBe("CONDUCTOR2 NO EXISTE");
  });

  it("carries PENDING through the map", () => {
    const mapped = mapBookingToPlannedService(booking({ syncStatus: "PENDING" }));
    expect(mapped?.planned.syncStatus).toBe("PENDING");
  });
});

describe("mapBookingToPlannedService — service type recovery", () => {
  // Without this, a task-driven assign silently downgrades to the legacy
  // GET-endTask path: the assigned tuple is dropped and nothing is pushed to
  // Alerce. ECM-written booking rows do not persist mintral_serviceType, so it
  // must be recovered from the `${code}-${type}` resource id.
  it("recovers mintral_serviceType from the resource id when not stored", () => {
    // fixture id is 1658427-V, data carries no mintral_serviceType
    const mapped = mapBookingToPlannedService(booking());
    expect(mapped?.planned.service.mintral_serviceType).toBe("V");
  });

  it("prefers a stored mintral_serviceType over the id suffix", () => {
    const mapped = mapBookingToPlannedService(
      booking({
        resource: {
          id: "1658427-V",
          type: "service",
          data: { mintral_serviceType: "R" },
        },
      })
    );
    expect(mapped?.planned.service.mintral_serviceType).toBe("R");
  });

  it("leaves mintral_serviceType unset when the id has no suffix and none is stored", () => {
    const mapped = mapBookingToPlannedService(
      booking({ resource: { id: "1658427", type: "service", data: {} } })
    );
    expect(mapped?.planned.service.mintral_serviceType).toBeUndefined();
  });
});
