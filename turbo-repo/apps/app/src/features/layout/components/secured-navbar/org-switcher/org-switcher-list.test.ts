import { describe, expect, it } from "vitest";
import {
  filterOrgs,
  initials,
  pickRecent,
  pushRecent,
  type SwitcherOrg,
} from "./org-switcher-list";

const org = (
  slug: string,
  displayName: string,
  taxId: string | null = null
): SwitcherOrg => ({
  slug,
  displayName,
  taxId,
  isParent: taxId === null,
});

const ORGS = [
  org("mbl:sudamerica", "Sudamerica Gps"),
  org("mbl:exacta", "Exacta", "76.123.456-7"),
  org("demo", "Demo"),
  org("mbl:egps", "eGPS"),
];

describe("filterOrgs", () => {
  it("sorts by name without a query", () => {
    expect(filterOrgs(ORGS, "").map((o) => o.displayName)).toEqual([
      "Demo",
      "eGPS",
      "Exacta",
      "Sudamerica Gps",
    ]);
  });

  it("ignores case and accents and needs every word", () => {
    expect(filterOrgs(ORGS, "SUDAMÉRICA gps").map((o) => o.slug)).toEqual([
      "mbl:sudamerica",
    ]);
    expect(filterOrgs(ORGS, "sudamerica exacta")).toEqual([]);
  });

  it("matches slug and tax id", () => {
    expect(filterOrgs(ORGS, "mbl:egps").map((o) => o.slug)).toEqual([
      "mbl:egps",
    ]);
    expect(filterOrgs(ORGS, "76.123").map((o) => o.slug)).toEqual([
      "mbl:exacta",
    ]);
  });

  it("matches a tax id typed without dots or dash", () => {
    for (const query of ["761234567", "76123456-7"]) {
      expect(filterOrgs(ORGS, query).map((o) => o.slug)).toEqual([
        "mbl:exacta",
      ]);
    }
  });
});

describe("recents", () => {
  it("puts the new slugs first without duplicates, at most five", () => {
    expect(pushRecent(["a", "b", "c", "d", "e"], "c", "x")).toEqual([
      "c",
      "x",
      "a",
      "b",
      "d",
    ]);
  });

  it("skips the active org and orgs the user no longer has", () => {
    expect(
      pickRecent(ORGS, ["demo", "gone", "mbl:exacta"], "demo").map(
        (o) => o.slug
      )
    ).toEqual(["mbl:exacta"]);
  });
});

describe("initials", () => {
  it("takes two words or the first two letters", () => {
    expect(initials("Sudamerica Gps")).toBe("SG");
    expect(initials("eGPS")).toBe("EG");
  });
});
