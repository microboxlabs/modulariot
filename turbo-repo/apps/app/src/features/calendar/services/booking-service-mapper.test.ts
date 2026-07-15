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

  it("maps CANCELLED to the terminal 'cancelled' stage", () => {
    const mapped = mapBookingToPlannedService(booking({ status: "CANCELLED" }));
    expect(mapped?.planned.workflowStage).toBe("cancelled");
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
