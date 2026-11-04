import { describe, expect, it } from "vitest";
import type { TowerContact } from "./control-tower-api";
import { scopeRoles, storedTarget, stepTarget } from "./contact-roles";

describe("stepTarget", () => {
  it("reads older steps without a scope", () => {
    expect(stepTarget("Conductor", null)).toEqual({
      scope: "DRIVER",
      role: null,
    });
    expect(stepTarget(" transportista ", undefined)).toEqual({
      scope: "TRIP_CARRIER",
      role: null,
    });
    expect(stepTarget("Jefe de torre", null)).toEqual({
      scope: "ORG",
      role: "Jefe de torre",
    });
    expect(stepTarget("", null)).toBeNull();
    expect(stepTarget(null, null)).toBeNull();
  });

  it("keeps a saved scope", () => {
    expect(stepTarget("Gerente de Seguridad", "TRIP_CARRIER")).toEqual({
      scope: "TRIP_CARRIER",
      role: "Gerente de Seguridad",
    });
    expect(stepTarget("", "TRIP_CARRIER")).toEqual({
      scope: "TRIP_CARRIER",
      role: null,
    });
    expect(stepTarget("Conductor", "DRIVER")).toEqual({
      scope: "DRIVER",
      role: null,
    });
    expect(stepTarget("", "ORG")).toEqual({ scope: "ORG", role: null });
  });
});

describe("storedTarget", () => {
  it("stores the driver as Conductor and any carrier role as empty", () => {
    expect(storedTarget({ scope: "DRIVER", role: null })).toEqual({
      role: "Conductor",
      scope: "DRIVER",
    });
    expect(storedTarget({ scope: "TRIP_CARRIER", role: null })).toEqual({
      role: "",
      scope: "TRIP_CARRIER",
    });
    expect(storedTarget({ scope: "ORG", role: "Jefe" })).toEqual({
      role: "Jefe",
      scope: "ORG",
    });
    expect(storedTarget(null)).toEqual({ role: "", scope: null });
  });
});

const contact = (patch: Partial<TowerContact>): TowerContact =>
  ({
    id: "c",
    name: "N",
    role: null,
    active: true,
    companyRut: null,
    ...patch,
  }) as TowerContact;

describe("scopeRoles", () => {
  it("splits carrier people from the organization's own and counts active ones", () => {
    const roles = scopeRoles([
      contact({ role: "Gerente de Seguridad", companyRut: "000000030" }),
      contact({ role: " gerente de seguridad ", companyRut: "000000050" }),
      contact({
        role: "Gerente de Seguridad",
        companyRut: "000000030",
        active: false,
      }),
      contact({ role: "Conductor", companyRut: "000000030" }),
      contact({ role: "Jefe de Torre" }),
      contact({ role: "Jefe de Torre", active: false }),
      contact({ role: "Transportista" }),
      contact({ role: "" }),
    ]);
    expect(roles.carrier).toEqual([
      { role: "Conductor", activeContacts: 1 },
      { role: "Gerente de Seguridad", activeContacts: 2 },
    ]);
    expect(roles.org).toEqual([
      { role: "Jefe de Torre", activeContacts: 1 },
      { role: "Transportista", activeContacts: 1 },
    ]);
  });
});
