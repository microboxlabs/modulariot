import { render, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CalendarSearchProvider,
  useCalendarSearchContext,
  type CalendarSearchContextValue,
} from "./calendar-search-context";
import type { CalendarSearchResult } from "@/features/calendar/services/use-calendar-search";
import type { MappedBooking } from "@/features/calendar/services/booking-service-mapper";
import type { SelectedService } from "./planning-selection-types";

const setSearchMatchIds = vi.fn();
const setFocusedItemId = vi.fn();
const push = vi.fn();

let searchResult: CalendarSearchResult;
let url: string;

vi.mock("./planning-selection-context", () => ({
  usePlanningSelection: () => ({
    calendarId: "cal-A",
    setSearchMatchIds,
    setFocusedItemId,
  }),
}));

vi.mock("@/features/calendar/services/use-calendar-search", () => ({
  useCalendarSearch: () => searchResult,
}));

vi.mock("@/features/common/providers/client-api.provider", () => ({
  useCalendars: () => ({
    calendars: [
      { id: "cal-A", name: "Santiago", groups: [{ code: "SCL" }] },
      { id: "cal-B", name: "Antofagasta", groups: [{ code: "ANF" }] },
      { id: "cal-C", name: "Iquique", groups: [] },
      // Belongs to two groups; groups[0] is ANF, but it's also in SCL.
      { id: "cal-D", name: "Shared", groups: [{ code: "ANF" }, { code: "SCL" }] },
    ],
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/es/calendar/cal-A/planning",
  useSearchParams: () => new URLSearchParams(url),
}));

function match(
  id: string,
  calendarId: string,
  date = "2026-07-20"
): MappedBooking {
  return {
    bookingId: `bk-${id}`,
    calendarId,
    planned: {
      service: { id } as SelectedService,
      slot: { date: new Date(`${date}T00:00:00`), hour: 10, minutes: 0 },
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

const lastMatchIds = () =>
  setSearchMatchIds.mock.calls.at(-1)?.[0] as ReadonlySet<string> | null;
const lastFocus = () =>
  setFocusedItemId.mock.calls.at(-1)?.[0] as string | null;
const pushedUrl = () => (push.mock.calls.at(-1)?.[0] as string) ?? "";
const pushedParams = () => new URLSearchParams(pushedUrl().split("?")[1] ?? "");

let ctx: CalendarSearchContextValue;
function Probe() {
  ctx = useCalendarSearchContext();
  return null;
}

function mount() {
  return render(
    <CalendarSearchProvider>
      <Probe />
    </CalendarSearchProvider>
  );
}

describe("CalendarSearchProvider — highlight", () => {
  beforeEach(() => {
    setSearchMatchIds.mockClear();
    setFocusedItemId.mockClear();
    push.mockClear();
    url = "";
  });

  it("pushes null when no search is running, so nothing dims", () => {
    searchResult = result({ active: false });
    mount();
    expect(lastMatchIds()).toBeNull();
  });

  it("pushes null while the first fetch is in flight", () => {
    // Guards the flash-of-everything-dimmed: mid-fetch `matches` is still [],
    // which must not be mistaken for "a search that matched nothing".
    searchResult = result({ isLoading: true });
    mount();
    expect(lastMatchIds()).toBeNull();
  });

  it("pushes null when the fetch failed — an error is not an empty result", () => {
    searchResult = result({ error: new Error("network") });
    mount();
    expect(lastMatchIds()).toBeNull();
  });

  it("pushes an EMPTY set when the search genuinely matched nothing here", () => {
    // Distinct from null: a real zero-result search must dim every chip.
    searchResult = result({ matches: [] });
    mount();
    expect(lastMatchIds()).toEqual(new Set());
  });

  it("highlights only matches belonging to the calendar on screen", () => {
    // The cross-calendar hit still counts as a match — the navigator offers to
    // travel to it — but it must not be highlighted on this calendar's grid.
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-2", "cal-B")],
    });
    mount();
    expect(lastMatchIds()).toEqual(new Set(["svc-1"]));
  });

  it("clears highlight and focus on unmount, so leaving cannot strand them", () => {
    searchResult = result({ matches: [match("svc-1", "cal-A")] });
    const view = mount();
    view.unmount();
    expect(lastMatchIds()).toBeNull();
    expect(lastFocus()).toBeNull();
  });
});

describe("CalendarSearchProvider — focus", () => {
  beforeEach(() => {
    setFocusedItemId.mockClear();
    push.mockClear();
  });

  it("focuses the match named by ?focus= when it lives in this calendar", () => {
    url = "focus=bk-svc-1";
    searchResult = result({ matches: [match("svc-1", "cal-A")] });
    mount();
    expect(lastFocus()).toBe("svc-1");
    expect(ctx.currentIndex).toBe(0);
  });

  it("focuses nothing when ?focus= points into a different calendar", () => {
    // It is still the current match (the navigator says "in Antofagasta"), but
    // there is no chip for it on this grid to focus.
    url = "focus=bk-svc-2";
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-2", "cal-B")],
    });
    mount();
    expect(lastFocus()).toBeNull();
    expect(ctx.currentMatch?.calendarId).toBe("cal-B");
  });
});

describe("CalendarSearchProvider — navigation", () => {
  beforeEach(() => {
    push.mockClear();
    url = "";
  });

  it("auto-jumps to the first match, since a hit is usually off-screen", () => {
    searchResult = result({ matches: [match("svc-1", "cal-A", "2026-08-03")] });
    mount();
    expect(pushedParams().get("date")).toBe("2026-08-03");
    expect(pushedParams().get("focus")).toBe("bk-svc-1");
  });

  it("auto-jumps to a match in the current calendar over an earlier one elsewhere", () => {
    // Submitting a search that has hits here must light them up in place, not
    // remount the grid by jumping to another calendar the instant you search.
    // svc-1 (cal-B) sorts first, but cal-A is on screen, so svc-2 wins.
    searchResult = result({
      matches: [match("svc-1", "cal-B"), match("svc-2", "cal-A")],
    });
    mount();
    expect(pushedUrl()).toContain("/es/calendar/cal-A/planning");
    expect(pushedParams().get("focus")).toBe("bk-svc-2");
  });

  it("does not auto-jump once the user is parked on a real match", () => {
    url = "focus=bk-svc-1";
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-2", "cal-A")],
    });
    mount();
    expect(push).not.toHaveBeenCalled();
  });

  it("keeps the same calendar route when the next match is in this calendar", () => {
    url = "focus=bk-svc-1";
    searchResult = result({
      matches: [
        match("svc-1", "cal-A"),
        match("svc-2", "cal-A", "2026-07-25"),
      ],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedUrl()).toContain("/es/calendar/cal-A/planning");
    expect(pushedParams().get("date")).toBe("2026-07-25");
  });

  it("swaps the calendarId segment when the next match lives elsewhere", () => {
    url = "focus=bk-svc-1";
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-2", "cal-B")],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedUrl()).toContain("/es/calendar/cal-B/planning");
    expect(pushedParams().get("focus")).toBe("bk-svc-2");
  });

  it("carries the target's groupCode across a cross-calendar jump", () => {
    // Without this the title's picker lists the OLD group's calendars, and the
    // calendar you just landed on is missing from its own picker.
    url = "focus=bk-svc-1&groupCode=SCL";
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-2", "cal-B")],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedParams().get("groupCode")).toBe("ANF");
  });

  it("drops groupCode when the target calendar has no group", () => {
    url = "focus=bk-svc-1&groupCode=SCL";
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-3", "cal-C")],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedParams().has("groupCode")).toBe(false);
  });

  it("keeps the current group when the target calendar also belongs to it", () => {
    // cal-D is in [ANF, SCL]. Coming from SCL, blindly taking groups[0] (ANF)
    // would yank a shared calendar into a different group; SCL must stick.
    url = "focus=bk-svc-1&groupCode=SCL";
    searchResult = result({
      matches: [match("svc-1", "cal-A"), match("svc-4", "cal-D")],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedParams().get("groupCode")).toBe("SCL");
  });

  it("drills month view down to day, where a match is always drawn", () => {
    // Month cells cap at 3 chips + "+N more", so a match can be highlighted and
    // still invisible.
    url = "focus=bk-svc-1&view=month";
    searchResult = result({
      matches: [
        match("svc-1", "cal-A"),
        match("svc-2", "cal-A", "2026-07-25"),
      ],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedParams().get("view")).toBe("day");
  });

  it("preserves a week view rather than forcing a drill-down", () => {
    url = "focus=bk-svc-1&view=week";
    searchResult = result({
      matches: [
        match("svc-1", "cal-A"),
        match("svc-2", "cal-A", "2026-07-25"),
      ],
    });
    mount();
    act(() => ctx.goNext());
    expect(pushedParams().get("view")).toBe("week");
  });

  it("wraps around at both ends", () => {
    url = "focus=bk-svc-1";
    searchResult = result({
      matches: [
        match("svc-1", "cal-A"),
        match("svc-2", "cal-A", "2026-07-25"),
      ],
    });
    mount();
    act(() => ctx.goPrevious());
    // From the first match, "previous" lands on the last.
    expect(pushedParams().get("focus")).toBe("bk-svc-2");
  });

  it("clearSearch drops every filter param and the focus", () => {
    url = "service=1626876&assignment=unassigned&focus=bk-svc-1&view=week";
    searchResult = result({ matches: [match("svc-1", "cal-A")] });
    mount();
    act(() => ctx.clearSearch());
    const p = pushedParams();
    expect(p.has("service")).toBe(false);
    expect(p.has("assignment")).toBe(false);
    expect(p.has("focus")).toBe(false);
    // Non-search params survive: clearing a search must not reset the view.
    expect(p.get("view")).toBe("week");
  });
});
