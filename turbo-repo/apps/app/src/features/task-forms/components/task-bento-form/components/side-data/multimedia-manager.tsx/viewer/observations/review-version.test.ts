import { describe, it, expect } from "vitest";
import {
  judgedCurrentVersion,
  splitByVersion,
  statusForCurrentVersion,
  versionOf,
} from "./review-version";
import type { StateChangeTimelineEntry, TimelineEntry } from "./observation.types";

let clock = 0;
/** Successive entries get increasing timestamps, so "newest group first" is testable. */
const decision = (over: Partial<StateChangeTimelineEntry> = {}): TimelineEntry => ({
  kind: "state_change",
  id: `sc-${(clock += 1)}`,
  status: "rejected",
  committedAt: new Date(1_700_000_000_000 + clock * 60_000),
  committedBy: "reviewer",
  observations: [],
  ...over,
});

const loose = (): TimelineEntry => ({
  kind: "observation",
  id: `loose-${(clock += 1)}`,
  types: ["poor_image_quality"],
  description: "Nota suelta",
  createdAt: new Date(1_700_000_000_000 + clock * 60_000),
});

describe("judgedCurrentVersion", () => {
  it("keeps a decision taken against the revision on screen", () => {
    expect(judgedCurrentVersion(decision({ version: "1.1" }), "1.1")).toBe(true);
  });

  it("files a decision taken against an earlier revision as history", () => {
    expect(judgedCurrentVersion(decision({ version: "1.0" }), "1.1")).toBe(false);
  });

  it("treats a decision taken before the node was versioned as an earlier revision", () => {
    // The first re-upload adds cm:versionable and lands v1.1, so the round that judged the
    // replaced bytes carries no label at all. It is still a different revision.
    expect(judgedCurrentVersion(decision({ version: null }), "1.1")).toBe(false);
  });

  it("matches an unversioned node against an unversioned decision", () => {
    expect(judgedCurrentVersion(decision({ version: null }), null)).toBe(true);
  });

  it("keeps a forum-era entry, which recorded no revision", () => {
    expect(judgedCurrentVersion(decision(), "1.1")).toBe(true);
  });

  it("keeps a loose observation, which is not a decision", () => {
    expect(judgedCurrentVersion(loose(), "1.1")).toBe(true);
  });
});

describe("splitByVersion", () => {
  it("separates the revision on screen from the ones it replaced", () => {
    const old = decision({ version: "1.0", status: "rejected" });
    const now = decision({ version: "1.1", status: "approved" });

    const { current, history } = splitByVersion([old, now], "1.1");

    expect(current).toEqual([now]);
    expect(history).toEqual([{ version: "1.0", entries: [old] }]);
  });

  it("collects every decision on one revision into a single group", () => {
    const first = decision({ version: "1.0", status: "rejected" });
    const second = decision({ version: "1.0", status: "pending" });

    const { history } = splitByVersion([first, second], "1.2");

    expect(history).toHaveLength(1);
    expect(history[0].entries).toEqual([first, second]);
  });

  it("orders history by when each revision was last decided, newest first", () => {
    const older = decision({ version: "1.0" });
    const newer = decision({ version: "1.1" });

    const { history } = splitByVersion([older, newer], "1.2");

    expect(history.map((g) => g.version)).toEqual(["1.1", "1.0"]);
  });

  it("groups unversioned decisions together rather than under the string 'null'", () => {
    const a = decision({ version: null });
    const b = decision({ version: null });

    const { history } = splitByVersion([a, b], "1.1");

    expect(history).toEqual([{ version: null, entries: [a, b] }]);
  });

  it("leaves a forum-era timeline entirely current", () => {
    const entries = [decision(), loose()];
    expect(splitByVersion(entries, "1.1")).toEqual({ current: entries, history: [] });
  });

  it("has nothing to split when there is no history", () => {
    expect(splitByVersion([], "1.0")).toEqual({ current: [], history: [] });
  });
});

describe("statusForCurrentVersion", () => {
  it("reports the newest decision on the revision on screen", () => {
    const entries = [
      decision({ version: "1.1", status: "rejected" }),
      decision({ version: "1.1", status: "approved" }),
    ];
    expect(statusForCurrentVersion(entries, "1.1")).toBe("approved");
  });

  it("reports pending when every decision judged content since replaced", () => {
    // servicio-1633381 as the repository holds it: one REJECTED round at v1.0, node at v1.1
    // after the driver re-sent the photo. The panel used to show that rejection as the
    // current verdict, so a photo nobody had looked at read as already refused.
    const entries = [decision({ version: "1.0", status: "rejected" })];
    expect(statusForCurrentVersion(entries, "1.1")).toBe("pending");
  });

  it("reports pending when the rounds predate versioning and the node has moved on", () => {
    const entries = [decision({ version: null, status: "rejected" })];
    expect(statusForCurrentVersion(entries, "1.1")).toBe("pending");
  });

  it("declines to answer for a forum-era timeline, leaving the stored status alone", () => {
    // Nothing here names a revision, so the panel cannot tell a stale verdict from a live
    // one. mintral:reviewStatus is the only fact that era recorded — this must not overrule it.
    expect(statusForCurrentVersion([decision({ status: "approved" })], "1.1")).toBeNull();
  });

  it("declines to answer for content that has never been reviewed", () => {
    expect(statusForCurrentVersion([], "1.0")).toBeNull();
  });

  it("ignores loose observations when deciding the verdict", () => {
    const entries = [loose(), decision({ version: "1.0", status: "approved" })];
    expect(statusForCurrentVersion(entries, "1.0")).toBe("approved");
  });

  it("takes a return-to-review as the standing verdict", () => {
    const entries = [
      decision({ version: "1.0", status: "rejected" }),
      decision({ version: "1.0", status: "pending" }),
    ];
    expect(statusForCurrentVersion(entries, "1.0")).toBe("pending");
  });
});

describe("versionOf", () => {
  it("reads the label the file list reports", () => {
    expect(versionOf({ properties: { "cm:versionLabel": "1.2" } })).toBe("1.2");
  });

  it("is null for a node the repository is not versioning", () => {
    expect(versionOf({ properties: {} })).toBeNull();
    expect(versionOf({})).toBeNull();
    expect(versionOf(undefined)).toBeNull();
  });
});
