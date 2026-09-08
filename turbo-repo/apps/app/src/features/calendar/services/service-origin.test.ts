import { describe, it, expect } from "vitest";
import {
  isPlannedInModule,
  matchesPlannerSource,
  parsePlannerSource,
} from "./service-origin";

describe("parsePlannerSource", () => {
  it("reads the two filters and treats everything else as all", () => {
    expect(parsePlannerSource("miot")).toBe("miot");
    expect(parsePlannerSource("synced")).toBe("synced");
    expect(parsePlannerSource(null)).toBeUndefined();
    expect(parsePlannerSource("")).toBeUndefined();
    expect(parsePlannerSource("MIOT")).toBeUndefined();
    expect(parsePlannerSource("alerce")).toBeUndefined();
  });
});

describe("isPlannedInModule", () => {
  it("counts either event", () => {
    expect(isPlannedInModule({ plannedIn: "miot" })).toBe(true);
    expect(isPlannedInModule({ assignedIn: "miot" })).toBe(true);
    // The sync placed the booking, an operator then assigned it here: the
    // planner who assigned it needs to find it again.
    expect(isPlannedInModule({ plannedIn: "alerce", assignedIn: "miot" })).toBe(
      true
    );
  });

  it("reads an unstamped booking as the sync's", () => {
    // Every row written before the stamp looks like this, as does every
    // booking the sync places on its own.
    expect(isPlannedInModule({})).toBe(false);
    expect(isPlannedInModule({ plannedIn: "alerce" })).toBe(false);
    expect(isPlannedInModule({ assignedIn: "alerce" })).toBe(false);
  });
});

describe("matchesPlannerSource", () => {
  const ours = { plannedIn: "miot" };
  const theirs = { assignedIn: "alerce" };

  it("keeps everything when no filter is set", () => {
    expect(matchesPlannerSource(ours, undefined)).toBe(true);
    expect(matchesPlannerSource(theirs, undefined)).toBe(true);
  });

  it("splits the board", () => {
    expect(matchesPlannerSource(ours, "miot")).toBe(true);
    expect(matchesPlannerSource(theirs, "miot")).toBe(false);
    expect(matchesPlannerSource(theirs, "synced")).toBe(true);
    expect(matchesPlannerSource(ours, "synced")).toBe(false);
  });

  it("puts an unstamped booking on the synced side", () => {
    expect(matchesPlannerSource({}, "synced")).toBe(true);
    expect(matchesPlannerSource({}, "miot")).toBe(false);
  });
});
