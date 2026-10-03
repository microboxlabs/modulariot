import { describe, expect, it } from "vitest";
import { isCarrierOrg, requireCarrierData } from "./carrier-scope";
import type { TenantScope } from "./tenant-scope";

function scopeDe(modules: string[], effectiveTaxIds: string[]): TenantScope {
  return {
    activeOrg: {
      id: 2,
      slug: "it-transportes",
      displayName: "IT Transportes S.A.",
      taxId: "76091703-6",
      role: "SITE_MANAGER",
      isParent: false,
      modules,
    },
    availableOrgs: [],
    effectiveTaxIds,
  };
}

// Regla de oro PT2 (diseno_pt1_portal.md §A.4 y §F.2): una org carrier
// NUNCA degrada a "sin filtro"; las orgs de torre conservan la degradación
// Phase 1 existente.
describe("requireCarrierData", () => {
  it("carrier sin tax ids ⇒ 403 (nunca 'todo')", async () => {
    const res = requireCarrierData(scopeDe(["CARRIER_PORTAL"], []));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
  });

  it("carrier con tax ids ⇒ continúa", () => {
    expect(
      requireCarrierData(scopeDe(["CARRIER_PORTAL"], ["76091703-6"]))
    ).toBeNull();
  });

  it("org de torre sin tax ids ⇒ continúa (degradación Phase 1 intacta)", () => {
    expect(requireCarrierData(scopeDe([], []))).toBeNull();
  });
});

describe("isCarrierOrg", () => {
  it("detecta el módulo CARRIER_PORTAL", () => {
    expect(isCarrierOrg(scopeDe(["CARRIER_PORTAL"], []))).toBe(true);
    expect(isCarrierOrg(scopeDe(["DASHBOARDS"], []))).toBe(false);
  });
});
