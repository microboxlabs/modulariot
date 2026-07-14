import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CalendarSearchProvider } from "./calendar-search-context";
import type { CalendarSearchResult } from "@/features/calendar/services/use-calendar-search";
import type { MappedBooking } from "@/features/calendar/services/booking-service-mapper";
import type { SelectedService } from "./planning-selection-types";

const setSearchMatchIds = vi.fn();
let searchResult: CalendarSearchResult;

vi.mock("./planning-selection-context", () => ({
  usePlanningSelection: () => ({
    calendarId: "cal-A",
    setSearchMatchIds,
  }),
}));

vi.mock("@/features/calendar/services/use-calendar-search", () => ({
  useCalendarSearch: () => searchResult,
}));

function match(id: string, calendarId: string): MappedBooking {
  return {
    bookingId: `booking-${id}`,
    calendarId,
    planned: {
      service: { id } as SelectedService,
      slot: { date: new Date("2026-07-20"), hour: 10, minutes: 0 },
    },
  };
}

function result(patch: Partial<CalendarSearchResult> = {}): CalendarSearchResult {
  return {
    active: true,
    params: {
      service: [],
      customer: [],
      origin: [],
      destination: [],
      licensePlate: [],
      tipoViaje: [],
      assignment: [],
    },
    matches: [],
    isLoading: false,
    ...patch,
  };
}

const lastPush = () =>
  setSearchMatchIds.mock.calls.at(-1)?.[0] as ReadonlySet<string> | null;

describe("CalendarSearchProvider", () => {
  beforeEach(() => {
    setSearchMatchIds.mockClear();
  });

  it("pushes null when no search is running, so nothing dims", () => {
    searchResult = result({ active: false });
    render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    expect(lastPush()).toBeNull();
  });

  it("pushes null while the first fetch is in flight", () => {
    // Guards the flash-of-everything-dimmed: mid-fetch `matches` is still [],
    // which must not be mistaken for "a search that matched nothing".
    searchResult = result({ active: true, isLoading: true });
    render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    expect(lastPush()).toBeNull();
  });

  it("pushes null when the fetch failed", () => {
    // An error is not an empty result set.
    searchResult = result({ active: true, error: new Error("network") });
    render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    expect(lastPush()).toBeNull();
  });

  it("pushes an EMPTY set when the search genuinely matched nothing here", () => {
    // Distinct from null: a real zero-result search must dim every chip.
    searchResult = result({ active: true, matches: [] });
    render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    expect(lastPush()).toEqual(new Set());
  });

  it("highlights only matches belonging to the calendar on screen", () => {
    // The cross-calendar hit still counts as a match (the navigator will offer
    // to travel to it), but it must not be highlighted on this calendar's grid.
    searchResult = result({
      active: true,
      matches: [match("svc-1", "cal-A"), match("svc-2", "cal-B")],
    });
    render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    expect(lastPush()).toEqual(new Set(["svc-1"]));
  });

  it("clears the highlight on unmount, so leaving cannot strand it", () => {
    searchResult = result({
      active: true,
      matches: [match("svc-1", "cal-A")],
    });
    const view = render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    expect(lastPush()).toEqual(new Set(["svc-1"]));
    view.unmount();
    expect(lastPush()).toBeNull();
  });

  it("settles instead of looping when the pushed set is unchanged", () => {
    // The effect writes into the very context it reads, so a new Set identity
    // on every render would spin forever.
    searchResult = result({
      active: true,
      matches: [match("svc-1", "cal-A")],
    });
    const view = render(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    const afterFirst = setSearchMatchIds.mock.calls.length;
    view.rerender(<CalendarSearchProvider>{null}</CalendarSearchProvider>);
    // A re-render must not queue another write: the memo's deps are unchanged.
    expect(setSearchMatchIds.mock.calls.length).toBe(afterFirst);
  });
});
