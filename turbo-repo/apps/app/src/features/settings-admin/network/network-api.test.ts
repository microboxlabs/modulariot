import { describe, expect, it } from "vitest";
import {
  accessExpiresAt,
  accessReasons,
  filterAssets,
  type AssetAccess,
  type NetworkAsset,
} from "./network-api";

const access = (
  reason: AssetAccess["reason"],
  expiresAt: string
): AssetAccess => ({
  reason,
  source: "TRIP",
  reference: "T-1",
  firstSeen: "2026-10-01T00:00:00Z",
  lastSeen: "2026-10-10T00:00:00Z",
  expiresAt,
});

const asset = (
  id: string,
  extra: Partial<NetworkAsset> = {}
): NetworkAsset => ({
  id,
  type: "Truck",
  label: `Tracto ${id}`,
  owner: { id: "andes", name: "Transportes Andes", roles: ["CARRIER"] },
  providers: [],
  access: [],
  ...extra,
});

describe("network-api helpers", () => {
  it("takes the latest expiry among the reasons", () => {
    const a = asset("A1", {
      access: [
        access("OPERATOR", "2026-10-17T00:00:00Z"),
        access("LINKED", "2026-12-01T00:00:00Z"),
      ],
    });
    expect(accessExpiresAt(a)).toBe("2026-12-01T00:00:00Z");
    expect(accessExpiresAt(asset("A2"))).toBeNull();
  });

  it("lists each reason once", () => {
    const a = asset("A1", {
      access: [
        access("OPERATOR", "2026-10-17T00:00:00Z"),
        access("OPERATOR", "2026-10-18T00:00:00Z"),
        access("LINKED", "2026-10-18T00:00:00Z"),
      ],
    });
    expect(accessReasons(a)).toEqual(["OPERATOR", "LINKED"]);
  });

  it("filters by id, label, type or owner, ignoring case", () => {
    const assets = [
      asset("ABCD12"),
      asset("JAULA-01", { type: "Jaula", label: null, owner: null }),
    ];
    expect(filterAssets(assets, " ").map((a) => a.id)).toEqual([
      "ABCD12",
      "JAULA-01",
    ]);
    expect(filterAssets(assets, "jaula").map((a) => a.id)).toEqual([
      "JAULA-01",
    ]);
    expect(filterAssets(assets, "andes").map((a) => a.id)).toEqual(["ABCD12"]);
  });
});
