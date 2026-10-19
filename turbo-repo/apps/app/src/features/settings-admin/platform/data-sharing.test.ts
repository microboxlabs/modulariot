import { describe, expect, it } from "vitest";
import {
  checkShare,
  coveredAssets,
  facet,
  matchPasted,
  parseIdList,
  shareStatus,
} from "./data-sharing";
import type {
  CreateDataShare,
  DataShare,
  DataShareAsset,
} from "./platform.types";

const NOW = Date.parse("2026-10-19T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

function asset(id: string, owner = "", kind = "Tracto"): DataShareAsset {
  return { id, owner, kind, lastSeen: at(0) };
}

const ASSETS: Record<string, DataShareAsset[]> = {
  gps: [
    asset("AAAA11", "Andes", "Tracto"),
    asset("BBBB22", "Andes", "Jaula"),
    asset("CCCC33", "Sur", "Tracto"),
  ],
  carrier: [asset("DDDD44", "Sur"), asset("EEEE55", "Sur")],
};

function share(overrides: Partial<DataShare>): DataShare {
  return {
    id: "s",
    sourceOrg: "gps",
    targetOrg: "op",
    scope: "ALL",
    filter: null,
    assetIds: [],
    assetCount: 0,
    origin: "MANUAL",
    status: "ACTIVE",
    validFrom: at(-1),
    validTo: null,
    note: null,
    createdBy: "owner@example.com",
    createdAt: at(-1),
    revokedAt: null,
    revokedBy: null,
    ...overrides,
  };
}

function draft(overrides: Partial<CreateDataShare>): CreateDataShare {
  return {
    sourceOrg: "gps",
    targetOrg: "op",
    scope: "ALL",
    filter: null,
    assetIds: [],
    validFrom: at(0),
    validTo: null,
    note: null,
    ...overrides,
  };
}

describe("shareStatus", () => {
  it("puts revoked ahead of the dates", () => {
    expect(
      shareStatus(share({ revokedAt: at(-1), validFrom: at(5) }), NOW)
    ).toBe("REVOKED");
  });

  it("reads the validity window", () => {
    expect(shareStatus(share({ validFrom: at(2) }), NOW)).toBe("SCHEDULED");
    expect(shareStatus(share({ validTo: at(-1) }), NOW)).toBe("EXPIRED");
    expect(shareStatus(share({ validTo: at(1) }), NOW)).toBe("ACTIVE");
  });
});

describe("coveredAssets", () => {
  it("combines the filter lists with AND", () => {
    const covered = coveredAssets(
      share({
        scope: "FILTER",
        filter: { owners: ["Andes"], kinds: ["Tracto"] },
      }),
      ASSETS.gps ?? []
    );
    expect(covered.map((a) => a.id)).toEqual(["AAAA11"]);
  });

  it("keeps only listed ids that the source owns", () => {
    const covered = coveredAssets(
      share({ scope: "ASSETS", assetIds: ["CCCC33", "ZZZZ99"] }),
      ASSETS.gps ?? []
    );
    expect(covered.map((a) => a.id)).toEqual(["CCCC33"]);
  });
});

describe("pasted lists", () => {
  it("splits on lines, commas, semicolons and tabs, without repeats", () => {
    expect(parseIdList("A1\nB2, C3;D4\tA1 \n\n")).toEqual([
      "A1",
      "B2",
      "C3",
      "D4",
    ]);
  });

  it("matches ids ignoring case and reports the rest", () => {
    expect(matchPasted("aaaa11\nZZZZ99\nCCCC33", ASSETS.gps ?? [])).toEqual({
      found: ["AAAA11", "CCCC33"],
      missing: ["ZZZZ99"],
    });
  });
});

describe("facet", () => {
  it("orders values by count, then name", () => {
    expect(facet(ASSETS.gps ?? [], (a) => a.owner)).toEqual([
      { value: "Andes", count: 2 },
      { value: "Sur", count: 1 },
    ]);
  });
});

describe("checkShare", () => {
  it("accepts a complete draft", () => {
    expect(checkShare(draft({}), [], NOW)).toBeNull();
  });

  it("refuses an organization sharing with itself", () => {
    expect(checkShare(draft({ targetOrg: "gps" }), [], NOW)).toBe("sameOrg");
  });

  it("needs a criterion for a filter and assets for a list", () => {
    expect(
      checkShare(
        draft({ scope: "FILTER", filter: { owners: [], kinds: [] } }),
        [],
        NOW
      )
    ).toBe("filter");
    expect(checkShare(draft({ scope: "ASSETS" }), [], NOW)).toBe("assets");
  });

  it("needs the end after the start", () => {
    expect(checkShare(draft({ validTo: at(-1) }), [], NOW)).toBe("dates");
  });

  it("refuses a second share of everything between the same pair", () => {
    expect(checkShare(draft({}), [share({})], NOW)).toBe("duplicate");
    expect(
      checkShare(draft({}), [share({ revokedAt: at(-1) })], NOW)
    ).toBeNull();
  });
});
