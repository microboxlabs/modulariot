import { describe, it, expect } from "vitest";
import { findNextUndecided } from "./viewer-utils";
import type { MediaViewerItem } from "./media-inline-viewer";
import type { ReviewStatus } from "../gallery/media-row";

/** Minimal shape findNextUndecided reads: an id per item. */
const items = (...ids: string[]) =>
  ids.map((id) => ({ file: { entry: { id } } })) as unknown as MediaViewerItem[];

const statuses = (entries: Record<string, ReviewStatus>) =>
  new Map(Object.entries(entries)) as Map<string, ReviewStatus>;

describe("findNextUndecided", () => {
  it("hands over the next pending file", () => {
    expect(
      findNextUndecided(items("a", "b", "c"), 0, new Map(), statuses({ a: "approved" }))
    ).toBe(1);
  });

  it("wraps around to a pending file before the current one", () => {
    expect(
      findNextUndecided(items("a", "b", "c"), 2, new Map(), statuses({ b: "approved" }))
    ).toBe(0);
  });

  it("treats a rejected file as decided", () => {
    // The regression this pins: rejecting is a decision. Counting only "approved"
    // as decided re-offered every rejected file as if it were untouched, so the
    // reviewer was walked back through work they had already done.
    expect(
      findNextUndecided(items("a", "b"), 0, new Map(), statuses({ a: "rejected", b: "rejected" }))
    ).toBeNull();
  });

  it("skips a rejected file to reach the one still pending", () => {
    expect(
      findNextUndecided(items("a", "b", "c"), 0, new Map(), statuses({ b: "rejected" }))
    ).toBe(2);
  });

  it("returns null once every file is decided, whichever way", () => {
    // Null is what closes the viewer. Without it the carousel cycled forever and
    // the reviewer had to dismiss it by hand.
    expect(
      findNextUndecided(
        items("a", "b", "c", "d"),
        1,
        new Map(),
        statuses({ a: "approved", b: "rejected", c: "approved", d: "rejected" })
      )
    ).toBeNull();
  });

  it("counts an unsaved draft decision as decided", () => {
    expect(
      findNextUndecided(items("a", "b"), 0, new Map([["b", "rejected" as ReviewStatus]]), new Map())
    ).toBeNull();
  });

  it("defaults a file with no recorded status to pending", () => {
    expect(findNextUndecided(items("a", "b"), 0, new Map(), new Map())).toBe(1);
  });
});
