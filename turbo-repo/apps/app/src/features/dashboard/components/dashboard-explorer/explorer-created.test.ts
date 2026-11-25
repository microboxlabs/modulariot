import { describe, expect, it } from "vitest";
import {
  formatCreated,
  formatCreatedRange,
  isNewDashboard,
  latestActivity,
} from "./explorer-created";

// Local times: "today" is the viewer's day, whatever the time zone.
const NOW = new Date(2026, 10, 20, 12, 0).getTime();
const at = (day: number, hour: number, minute = 0) =>
  new Date(2026, 10, day, hour, minute).toISOString();

describe("isNewDashboard", () => {
  it("counts a dashboard created today as new", () => {
    expect(isNewDashboard(at(20, 0, 0), NOW)).toBe(true);
    expect(isNewDashboard(at(20, 11, 59), NOW)).toBe(true);
  });

  it("stops counting it as new at midnight, not 24 hours later", () => {
    expect(isNewDashboard(at(19, 23, 59), NOW)).toBe(false);
    expect(isNewDashboard(at(13, 12), NOW)).toBe(false);
  });

  it("is not new when the date is missing or unreadable", () => {
    expect(isNewDashboard(undefined, NOW)).toBe(false);
    expect(isNewDashboard("not a date", NOW)).toBe(false);
  });

  it("tolerates a browser clock a little behind the server", () => {
    expect(isNewDashboard(at(20, 12, 5), NOW)).toBe(true);
    expect(isNewDashboard(at(21, 0, 30), NOW)).toBe(false);
  });
});

describe("formatCreated", () => {
  it("formats the date in the page's language", () => {
    const created = "2026-11-03T15:30:00Z";
    expect(formatCreated(created, "en")?.short).toBe(
      new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
        new Date(created)
      )
    );
    expect(formatCreated(created, "es")?.short).toBe(
      new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
        new Date(created)
      )
    );
  });

  it("is null when the date is not known", () => {
    expect(formatCreated(undefined, "en")).toBeNull();
    expect(formatCreated("", "en")).toBeNull();
    expect(formatCreated("garbage", "en")).toBeNull();
  });
});

describe("latestActivity", () => {
  const CREATED = "2026-11-20T10:00:00.000Z";
  const OPENED = "2026-11-22T10:00:00.000Z";
  const EDITED = "2026-11-23T10:00:00.000Z";

  it("is the creation until anything else happens", () => {
    expect(latestActivity({ createdAt: CREATED, updatedAt: CREATED })).toEqual({
      kind: "created",
      at: CREATED,
    });
  });

  it("is the last open once it was opened after that", () => {
    expect(
      latestActivity({
        createdAt: CREATED,
        updatedAt: CREATED,
        openedAt: OPENED,
      })
    ).toEqual({ kind: "opened", at: OPENED });
  });

  it("is the last edit once it was saved after the last open", () => {
    expect(
      latestActivity({
        createdAt: CREATED,
        updatedAt: EDITED,
        openedAt: OPENED,
      })
    ).toEqual({ kind: "edited", at: EDITED });
  });

  it("is the open again when opened after the edit", () => {
    expect(
      latestActivity({
        createdAt: CREATED,
        updatedAt: OPENED,
        openedAt: EDITED,
      })
    ).toEqual({ kind: "opened", at: EDITED });
  });

  it("prefers the edit when it was opened and saved at once", () => {
    expect(
      latestActivity({
        createdAt: CREATED,
        updatedAt: EDITED,
        openedAt: EDITED,
      })
    ).toEqual({ kind: "edited", at: EDITED });
  });

  it("counts a save as an edit when the creation is not known", () => {
    expect(latestActivity({ updatedAt: EDITED })).toEqual({
      kind: "edited",
      at: EDITED,
    });
  });

  it("is null with no date it can read", () => {
    expect(latestActivity({})).toBeNull();
    expect(latestActivity({ createdAt: "not a date" })).toBeNull();
  });
});

describe("formatCreatedRange", () => {
  // Intl puts thin spaces around the dash; compare with plain ones.
  const plain = (text: string) => text.replaceAll(/\s/gu, " ");

  it("shows a range this year without the year", () => {
    expect(
      plain(
        formatCreatedRange(
          { from: "2026-11-01 00:00:00", to: "2026-11-20 23:59:59" },
          "en",
          NOW
        )
      )
    ).toBe("Nov 1 – 20");
  });

  it("shows one date for a single day", () => {
    expect(
      plain(
        formatCreatedRange(
          { from: "2026-11-20 00:00:00", to: "2026-11-20 23:59:59" },
          "en",
          NOW
        )
      )
    ).toBe("Nov 20");
  });

  it("adds the year for another year", () => {
    expect(
      plain(
        formatCreatedRange(
          { from: "2025-12-01 00:00:00", to: "2026-01-10 23:59:59" },
          "en",
          NOW
        )
      )
    ).toBe("Dec 1, 2025 – Jan 10, 2026");
  });
});
