import { describe, it, expect } from "vitest";
import {
  isMatchTypeLocked,
  lockedTagsForCalendar,
  withLockedTags,
  type PlanningSearchTag,
} from "./planning-locked-tags";

const ORIGIN_TAG: PlanningSearchTag = {
  matchType: "origen",
  value: "ANF",
  locked: true,
};
const TYPE_TAG: PlanningSearchTag = {
  matchType: "tipoServicio",
  value: "otr",
  locked: true,
};
const TYPED: PlanningSearchTag = { matchType: "cliente", value: "C308" };

describe("lockedTagsForCalendar", () => {
  it("locks every field the calendar fixes", () => {
    expect(
      lockedTagsForCalendar({
        origin: "ANF",
        destination: "MEL",
        serviceType: "otr",
      })
    ).toEqual([
      { matchType: "origen", value: "ANF", locked: true },
      { matchType: "destino", value: "MEL", locked: true },
      { matchType: "tipoServicio", value: "otr", locked: true },
    ]);
  });

  it("locks nothing for a calendar that fixes nothing", () => {
    expect(lockedTagsForCalendar(null)).toEqual([]);
    expect(lockedTagsForCalendar({})).toEqual([]);
    expect(lockedTagsForCalendar({ origin: "", serviceType: "" })).toEqual([]);
  });

  it("drops a service type outside the three", () => {
    expect(lockedTagsForCalendar({ serviceType: "xyz" })).toEqual([]);
    expect(lockedTagsForCalendar({ serviceType: "OTE" })).toEqual([
      { matchType: "tipoServicio", value: "ote", locked: true },
    ]);
  });
});

describe("isMatchTypeLocked", () => {
  it("reports only fields the calendar fixes", () => {
    const tags = [ORIGIN_TAG, TYPED];
    expect(isMatchTypeLocked(tags, "origen")).toBe(true);
    expect(isMatchTypeLocked(tags, "cliente")).toBe(false);
    expect(isMatchTypeLocked(tags, "destino")).toBe(false);
  });
});

describe("withLockedTags", () => {
  it("restores a locked chip a rewrite dropped", () => {
    expect(withLockedTags([TYPED], [ORIGIN_TAG, TYPED])).toEqual([
      ORIGIN_TAG,
      TYPED,
    ]);
  });

  it("survives clearing every chip", () => {
    expect(withLockedTags([], [ORIGIN_TAG, TYPE_TAG, TYPED])).toEqual([
      ORIGIN_TAG,
      TYPE_TAG,
    ]);
  });

  it("keeps a locked value even when the rewrite replaces it", () => {
    const swapped: PlanningSearchTag = { matchType: "origen", value: "MEL" };
    expect(withLockedTags([swapped], [ORIGIN_TAG])).toEqual([ORIGIN_TAG]);
  });

  it("leaves an unconstrained calendar's chips alone", () => {
    expect(withLockedTags([TYPED], [TYPED])).toEqual([TYPED]);
    expect(withLockedTags([], [TYPED])).toEqual([]);
  });
});
