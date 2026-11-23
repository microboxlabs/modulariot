import { describe, expect, it, vi } from "vitest";
import type { TripMilestone } from "../milestones/milestones-api";
import type { TripSheet } from "./sheet-api";
import { plannedAt } from "./milestone-checklist";

vi.mock("@/features/i18n/tr.service", () => ({
  tr: (key: string) => key,
  trDynamic: (key: string) => key,
}));
vi.mock("@/features/settings-admin/team/team-api", () => ({
  useMyAccess: () => ({ access: { teams: [] } }),
}));
vi.mock("../monitors/monitors-api", () => ({
  tripsRequest: vi.fn(),
  useTripsPermission: () => true,
}));

const sheet = {
  card: {
    plannedStart: "2026-11-20T11:00:00Z",
    plannedArrival: "2026-11-20T17:00:00Z",
  },
} as unknown as TripSheet;

function milestone(
  name: string,
  patch: Partial<TripMilestone> = {}
): TripMilestone {
  return {
    tripId: "11111111-1111-1111-1111-111111111111",
    milestone: name,
    status: "open",
    source: null,
    proposedAt: null,
    evidence: {},
    confirmedAt: null,
    confirmedBy: null,
    channel: null,
    ...patch,
  } as TripMilestone;
}

describe("milestone plan time", () => {
  it("shows the planned time the milestone has", () => {
    expect(
      plannedAt(
        sheet,
        milestone("presentation", { plannedAt: "2026-11-20T09:00:00Z" })
      )
    ).toBe("2026-11-20T09:00:00Z");
  });

  it("falls back to the trip's planned start or arrival without one", () => {
    expect(plannedAt(sheet, milestone("presentation"))).toBe(
      "2026-11-20T11:00:00Z"
    );
    expect(plannedAt(sheet, milestone("arrival", { plannedAt: null }))).toBe(
      "2026-11-20T17:00:00Z"
    );
    expect(plannedAt(sheet, milestone("validation"))).toBeNull();
  });
});
