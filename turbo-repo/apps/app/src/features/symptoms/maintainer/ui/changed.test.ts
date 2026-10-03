import { describe, expect, it } from "vitest";
import { changedPaths, isChanged } from "./changed";

describe("changedPaths", () => {
  const published = {
    activation: "signal.trip.active",
    levels: [
      { icu: 3, response: { operator: true, slaMinutes: 5, notices: [] } },
      { icu: 4, response: { operator: true, slaMinutes: 2, notices: [] } },
    ],
    recurrence: null,
  };

  it("names each leaf that differs, with array indexes", () => {
    const draft = structuredClone(published);
    draft.levels[1].response.slaMinutes = 4;
    draft.activation = "true";
    expect([...changedPaths(draft, published)].sort()).toEqual([
      "activation",
      "levels.1.response.slaMinutes",
    ]);
  });

  it("treats missing and null as equal, and reports a changed list length", () => {
    const draft = structuredClone(published) as Record<string, unknown>;
    delete draft.recurrence;
    (
      draft.levels as { response: { notices: unknown[] } }[]
    )[0].response.notices = [{ channel: "teams" }];
    expect([...changedPaths(draft, published)].sort()).toEqual([
      "levels.0.response.notices",
      "levels.0.response.notices.0",
    ]);
  });

  it("finds changes under a path", () => {
    const paths = new Set(["levels.1.response.slaMinutes"]);
    expect(isChanged(paths, "levels.1")).toBe(true);
    expect(isChanged(paths, "levels.1.response.slaMinutes")).toBe(true);
    expect(isChanged(paths, "levels.10")).toBe(false);
    expect(isChanged(paths, "levels.0")).toBe(false);
  });
});

describe("changedPaths on rule text", () => {
  it("does not mark a rule that only gained line breaks, but marks a change inside quotes", () => {
    const published = { activation: 'a && b == "x  y"' };
    expect(
      changedPaths({ activation: 'a\n&& b == "x  y"' }, published).size
    ).toBe(0);
    expect([
      ...changedPaths({ activation: 'a\n&& b == "x y"' }, published),
    ]).toEqual(["activation"]);
  });
});
