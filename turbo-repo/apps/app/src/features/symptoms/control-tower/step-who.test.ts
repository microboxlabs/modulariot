import { describe, expect, it } from "vitest";
import { legacyWho, rolesIn, summarizeWho, whoOf } from "./step-who";

describe("legacyWho", () => {
  it("reads Conductor as the trip's driver by RUT", () => {
    expect(legacyWho("Conductor", null)).toBe(
      "contact.roleKey == 'conductor' && ((has(event.data.driverRut) && has(event.data.driverIdType) && contact.nationalIdType == event.data.driverIdType && contact.nationalId == event.data.driverRut) || (has(event.data.secondDriverRut) && has(event.data.secondDriverIdType) && contact.nationalIdType == event.data.secondDriverIdType && contact.nationalId == event.data.secondDriverRut))"
    );
    expect(legacyWho(null, "DRIVER")).toBe(legacyWho(" conductor ", null));
  });

  it("reads Transportista or the carrier scope as the trip carrier's people, with the role when there is one", () => {
    expect(legacyWho("Transportista", null)).toBe(
      "contact.companyRut == event.data.carrierRut && has(event.data.carrierIdType) && contact.companyTaxIdType == event.data.carrierIdType"
    );
    expect(legacyWho("", "TRIP_CARRIER")).toBe(
      "contact.companyRut == event.data.carrierRut && has(event.data.carrierIdType) && contact.companyTaxIdType == event.data.carrierIdType"
    );
    expect(legacyWho("Gerente de Seguridad", "TRIP_CARRIER")).toBe(
      "contact.roleKey == 'gerente de seguridad' && contact.companyRut == event.data.carrierRut && has(event.data.carrierIdType) && contact.companyTaxIdType == event.data.carrierIdType"
    );
  });

  it("reads any other role as that role of the book, and nothing as nobody", () => {
    expect(legacyWho("Jefe de torre", null)).toBe(
      "contact.roleKey == 'jefe de torre' && contact.companyRut == ''"
    );
    expect(legacyWho("Jefe de torre", "ORG")).toBe(
      "contact.roleKey == 'jefe de torre' && contact.companyRut == ''"
    );
    expect(legacyWho("  ", null)).toBe("");
  });

  it("keeps an explicit carrier role even when it is Transportista", () => {
    expect(legacyWho("Transportista", "TRIP_CARRIER")).toBe(
      "contact.roleKey == 'transportista' && contact.companyRut == event.data.carrierRut && has(event.data.carrierIdType) && contact.companyTaxIdType == event.data.carrierIdType"
    );
  });
});

describe("whoOf", () => {
  it("prefers the step's own condition over its older role", () => {
    expect(whoOf({ who: "'vip' in contact.tags", role: "Conductor" })).toBe(
      "'vip' in contact.tags"
    );
    expect(whoOf({ who: " ", role: "Jefe" })).toBe(
      "contact.roleKey == 'jefe' && contact.companyRut == ''"
    );
  });
});

const NONE = {
  role: null,
  roles: [],
  driver: false,
  carrier: false,
  carrierSelf: false,
  company: null,
};

describe("summarizeWho", () => {
  it("names the role and whether the trip's driver or carrier is meant", () => {
    expect(summarizeWho(legacyWho("Conductor", null))).toEqual({
      ...NONE,
      role: "Conductor",
      roles: ["Conductor"],
      driver: true,
      driverField: "either",
    });
    expect(summarizeWho(legacyWho("Gerente", "TRIP_CARRIER"))).toEqual({
      ...NONE,
      role: "gerente",
      roles: ["gerente"],
      carrier: true,
    });
    expect(summarizeWho(legacyWho("Jefe de torre", null))).toEqual({
      ...NONE,
      role: "jefe de torre",
      roles: ["jefe de torre"],
    });
  });

  it.each([
    [
      "contact.role == 'Supervisor'",
      { role: "Supervisor", roles: ["Supervisor"] },
    ],
    [
      "contact.role == 'Conductor' && contact.nationalId == event.data.driverRut",
      { role: "Conductor", roles: ["Conductor"], driver: true },
    ],
    [
      "contact.role == 'Conductor' && contact.nationalId == event.data.secondDriverRut",
      {
        role: "Conductor",
        roles: ["Conductor"],
        driver: true,
        driverField: "second",
      },
    ],
    [
      "contact.role == 'Transportista' && contact.nationalId == event.data.carrierRut",
      { role: "Transportista", roles: ["Transportista"], carrierSelf: true },
    ],
    [
      "contact.role == 'Despachador' && contact.companyRut == event.data.carrierRut",
      { role: "Despachador", roles: ["Despachador"], carrier: true },
    ],
    [
      "contact.role == 'Despachador' && contact.company == 'Empresa Uno'",
      { role: "Despachador", roles: ["Despachador"], company: "Empresa Uno" },
    ],
    [
      "contact.role == 'Supervisor' || contact.role == 'Jefe de turno'",
      { role: "Supervisor", roles: ["Supervisor", "Jefe de turno"] },
    ],
    [
      "(contact.role == 'Supervisor' || contact.role == 'Jefe de turno') && contact.companyRut == event.data.carrierRut",
      {
        role: "Supervisor",
        roles: ["Supervisor", "Jefe de turno"],
        carrier: true,
      },
    ],
  ])("reads %s", (who, expected) => {
    expect(summarizeWho(who)).toEqual({ ...NONE, ...expected });
  });

  it("reads the fields in either order and either side of ==", () => {
    const expected = {
      ...NONE,
      role: "Transportista",
      roles: ["Transportista"],
      carrierSelf: true,
    };
    expect(
      summarizeWho(
        "contact.nationalId == event.data.carrierRut && contact.role == 'Transportista'"
      )
    ).toEqual(expected);
    expect(
      summarizeWho(
        "event.data.carrierRut == contact.nationalId && 'Transportista' == contact.role"
      )
    ).toEqual(expected);
  });

  it("is null for other event fields and for conditions it cannot name", () => {
    expect(
      summarizeWho("contact.companyRut == event.data.otherRut")
    ).toBeNull();
    expect(
      summarizeWho("contact.role == 'A' || contact.company == 'B'")
    ).toBeNull();
    expect(summarizeWho("contact.position.startsWith('Jefe')")).toBeNull();
    expect(summarizeWho("")).toBeNull();
  });
});

describe("rolesIn", () => {
  it("finds the roles anywhere in a condition, once each", () => {
    expect(
      rolesIn(
        "contact.role == 'Supervisor' && (contact.position.startsWith('x') || 'Supervisor' == contact.role || contact.roleKey == \"jefe\")"
      )
    ).toEqual(["Supervisor", "jefe"]);
    expect(rolesIn("contact.position == 'x'")).toEqual([]);
  });
});
