/**
 * Coverage for the planner's flag filtering (issue #677): only incident
 * codes that participate in the calendar planning sort
 * (ecm-coordinator `MintralModel.INCIDENT_TIER_BY_CODE`) are shown, in tier
 * order. Everything else is dropped.
 */
import { describe, it, expect } from "vitest";
import { isSortingRelevant, getDisplayIncidencias } from "./incidencias.types";

const TIERED_CODES = [
  "C309",
  "C307",
  "C314",
  "C319",
  "C320",
  "C326",
  "C329",
  "C308",
];

describe("isSortingRelevant", () => {
  it("returns true for every tiered sort code", () => {
    for (const code of TIERED_CODES) {
      expect(isSortingRelevant(code)).toBe(true);
    }
  });

  it("resolves dictionary keys and labels, not just codes", () => {
    expect(isSortingRelevant("urgencia")).toBe(true);
    expect(isSortingRelevant("DESPACHO URGENTE")).toBe(true);
  });

  it("returns false for codes outside the sort hierarchy", () => {
    expect(isSortingRelevant("C999")).toBe(false);
    expect(isSortingRelevant("FOO")).toBe(false);
    expect(isSortingRelevant("")).toBe(false);
  });
});

describe("getDisplayIncidencias", () => {
  it("drops non-sort codes and keeps only the tiered ones", () => {
    const result = getDisplayIncidencias(["C314", "FOO", "C309", "C999"]);
    expect(result.map((i) => i.key)).toEqual(["C309", "C314"]);
  });

  it("orders the kept codes by tier (priority ascending)", () => {
    const result = getDisplayIncidencias(["C308", "C309", "C307"]);
    expect(result.map((i) => i.key)).toEqual(["C309", "C307", "C308"]);
  });

  it("returns an empty array when no code is sort-relevant", () => {
    expect(getDisplayIncidencias(["FOO", "BAR"])).toEqual([]);
  });
});
