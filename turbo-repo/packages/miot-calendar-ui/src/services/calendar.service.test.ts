import { describe, expect, it } from "vitest";
import {
  DATE_FORMAT,
  VIEW_MODES,
  generateTimeSlots,
  isValidViewMode,
  parseUrlDate,
} from "./calendar.service";
import {
  apiToLocalTimeWindow,
  localToApiTimeWindow,
  TimeWindowResponseSchema,
} from "./time-window.service";
import { TimeWindowUtils } from "../components/planning/time-window";

describe("isValidViewMode", () => {
  it("accepts the three supported view modes", () => {
    expect(VIEW_MODES.has("day")).toBe(true);
    for (const mode of ["day", "week", "month"]) {
      expect(isValidViewMode(mode)).toBe(true);
    }
  });

  it("rejects null and unknown values", () => {
    expect(isValidViewMode(null)).toBe(false);
    expect(isValidViewMode("year")).toBe(false);
    expect(isValidViewMode("")).toBe(false);
  });
});

describe("parseUrlDate", () => {
  it("returns null for null or empty input", () => {
    expect(parseUrlDate(null)).toBeNull();
    expect(parseUrlDate("")).toBeNull();
  });

  it("parses a valid ISO date", () => {
    const parsed = parseUrlDate("2026-05-31");
    expect(parsed).not.toBeNull();
    expect(parsed?.format(DATE_FORMAT)).toBe("2026-05-31");
  });

  it("returns null for an unparseable string", () => {
    expect(parseUrlDate("not-a-date")).toBeNull();
  });
});

describe("generateTimeSlots", () => {
  it("emits two 30-minute slots per hour in range", () => {
    const slots = generateTimeSlots(9, 11);
    expect(slots).toEqual([
      { hour: 9, minutes: 0, label: "09:00" },
      { hour: 9, minutes: 30, label: "09:30" },
      { hour: 10, minutes: 0, label: "10:00" },
      { hour: 10, minutes: 30, label: "10:30" },
    ]);
  });

  it("returns an empty list when start >= end", () => {
    expect(generateTimeSlots(10, 10)).toEqual([]);
  });
});

describe("TimeWindowUtils", () => {
  it("parses a weekly pattern into components", () => {
    expect(TimeWindowUtils.parseWeeklyPattern("W* 1-5 0900-1700")).toEqual({
      weeks: [],
      days: [1, 2, 3, 4, 5],
      startHour: 9,
      startMinutes: 0,
      endHour: 17,
      endMinutes: 0,
    });
  });

  it("returns null for a malformed pattern", () => {
    expect(TimeWindowUtils.parseWeeklyPattern("nope")).toBeNull();
  });

  it("formats number arrays as compact ranges", () => {
    expect(TimeWindowUtils.formatRangeString([1, 2, 3, 4, 5])).toBe("1-5");
    expect(TimeWindowUtils.formatRangeString([1, 3, 5])).toBe("1,3,5");
    expect(TimeWindowUtils.formatRangeString([], "W")).toBe("W*");
  });
});

describe("time-window.service round trip", () => {
  it("validates and maps an API weekly window to a local TimeSlot", () => {
    const response = TimeWindowResponseSchema.parse({
      id: "tw-1",
      calendarId: "cal-1",
      name: "Morning",
      startHour: 9,
      endHour: 17,
      slotDurationMinutes: 30,
      capacity: 4,
      daysOfWeek: "1-5",
      validFrom: "2026-01-01",
      validTo: "2026-12-31",
      active: true,
    });
    const local = apiToLocalTimeWindow(response);
    expect(local.kind).toBe("window");
    expect(local.type).toBe("weekly");
    expect(local.quota).toBe(4);
    expect(local.weeklyPattern).toBe("W* 1-5 0900-1700");
  });

  it("maps a local weekly window back to an API request", () => {
    const request = localToApiTimeWindow({
      id: "tw-1",
      name: "Morning",
      kind: "window",
      type: "weekly",
      weeklyPattern: "W* 1-5 0900-1700",
      quota: 4,
    });
    expect(request.kind).toBe("WINDOW");
    expect(request.startHour).toBe(9);
    expect(request.endHour).toBe(17);
    expect(request.daysOfWeek).toBe("1,2,3,4,5");
    expect(request.capacity).toBe(4);
  });
});
