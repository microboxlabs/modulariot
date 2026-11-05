import { describe, expect, it } from "vitest";
import { legacyWho, summarizeWho, whoOf } from "./step-who";

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

describe("summarizeWho", () => {
  it("names the role and whether the trip's driver or carrier is meant", () => {
    expect(summarizeWho(legacyWho("Conductor", null))).toEqual({
      role: "Conductor",
      driver: true,
      carrier: false,
      driverField: "either",
    });
    expect(summarizeWho(legacyWho("Gerente", "TRIP_CARRIER"))).toEqual({
      role: "gerente",
      driver: false,
      carrier: true,
    });
  });

  it("does not infer a primary-driver or carrier preset for other event fields", () => {
    expect(
      summarizeWho("contact.nationalId == event.data.secondDriverRut")
    ).toBeNull();
    expect(
      summarizeWho("contact.companyRut == event.data.otherRut")
    ).toBeNull();
  });

  it("is null for a condition the clauses cannot say", () => {
    expect(
      summarizeWho("contact.role == 'A' || contact.role == 'B'")
    ).toBeNull();
  });
});
