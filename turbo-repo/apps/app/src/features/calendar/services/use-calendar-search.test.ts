import { describe, it, expect } from "vitest";
import { withResolvedClient } from "./use-calendar-search";
import type { MappedBooking } from "./booking-service-mapper";
import type { SelectedService } from "@/features/calendar/components/planning/planning-selection-types";

function match(service: Partial<SelectedService>): MappedBooking {
  return {
    bookingId: "booking-1",
    calendarId: "cal-A",
    planned: {
      service: { id: "1658427-V", cliente: "", ...service } as SelectedService,
      slot: { date: new Date("2026-07-13T00:00:00Z"), hour: 5, minutes: 0 },
    },
  };
}

describe("withResolvedClient", () => {
  it("fills a blank client from the live index", () => {
    const out = withResolvedClient(
      match({ mintral_serviceCode: "1658427" }),
      (code) => (code === "1658427" ? "ACME" : undefined)
    );
    expect(out.planned.service.cliente).toBe("ACME");
  });

  // Must match `resolveItemOverlay`'s policy exactly: the grid overlays the
  // live value over a stored one, so a search that kept the stored value would
  // render a row as NEW and refuse to match `?customer=NEW`.
  it("lets the live client win over a stale stored one, as the grid does", () => {
    const out = withResolvedClient(
      match({ mintral_serviceCode: "1658427", cliente: "OLD" }),
      () => "NEW"
    );
    expect(out.planned.service.cliente).toBe("NEW");
  });

  it("returns by reference when the live client repeats the stored one", () => {
    const input = match({ mintral_serviceCode: "1658427", cliente: "ACME" });
    expect(withResolvedClient(input, () => "ACME")).toBe(input);
  });

  it("keeps a stored client the live index cannot answer for", () => {
    const input = match({ mintral_serviceCode: "1658427", cliente: "STORED" });
    expect(withResolvedClient(input, () => undefined)).toBe(input);
  });

  it("returns the match untouched when the live index has no answer", () => {
    const input = match({ mintral_serviceCode: "1658427" });
    expect(withResolvedClient(input, () => undefined)).toBe(input);
  });

  it("returns the match untouched with no resolver", () => {
    const input = match({ mintral_serviceCode: "1658427" });
    expect(withResolvedClient(input)).toBe(input);
  });

  it("preserves the slot and booking id when it does overlay", () => {
    const input = match({ mintral_serviceCode: "1658427" });
    const out = withResolvedClient(input, () => "ACME");
    expect(out.bookingId).toBe("booking-1");
    expect(out.planned.slot).toBe(input.planned.slot);
  });
});
