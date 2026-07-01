import { describe, expect, it } from "vitest";
import { formatRemaining, windowState } from "./session-window";

const NOW = Date.parse("2026-06-30T12:00:00Z");
const hours = (h: number) => new Date(NOW + h * 60 * 60 * 1000).toISOString();

describe("windowState", () => {
  it("is closed when there is no session (never opened by an inbound)", () => {
    expect(windowState(null, NOW).status).toBe("closed");
  });

  it("is closed when the expiry is in the past", () => {
    expect(windowState(hours(-1), NOW).status).toBe("closed");
  });

  it("is closed for an unparseable timestamp", () => {
    expect(windowState("not-a-date", NOW).status).toBe("closed");
  });

  it("is open with more than 2h remaining", () => {
    const state = windowState(hours(5), NOW);
    expect(state.status).toBe("open");
    expect(state.remainingMs).toBe(5 * 60 * 60 * 1000);
  });

  it("is closingSoon within the last 2h", () => {
    expect(windowState(hours(1), NOW).status).toBe("closingSoon");
  });
});

describe("formatRemaining", () => {
  it("shows hours and minutes when an hour or more is left", () => {
    expect(formatRemaining(5 * 60 * 60 * 1000 + 12 * 60 * 1000)).toBe("5h 12m");
  });

  it("shows only minutes under an hour", () => {
    expect(formatRemaining(45 * 60 * 1000)).toBe("45m");
  });

  it("is empty once closed", () => {
    expect(formatRemaining(0)).toBe("");
  });
});
