import { describe, expect, it } from "vitest";
import { parseClauses } from "@/features/conversations/contact-condition";
import { legacyWho, summarizeWho, whoOf } from "./step-who";

describe("legacyWho", () => {
  it("reads Conductor as the trip's driver by RUT", () => {
    expect(legacyWho("Conductor", null)).toBe(
      "contact.role == 'Conductor' && contact.nationalId == event.data.driverRut"
    );
    expect(legacyWho(null, "DRIVER")).toBe(legacyWho(" conductor ", null));
  });

  it("reads Transportista or the carrier scope as the trip carrier's people, with the role when there is one", () => {
    expect(legacyWho("Transportista", null)).toBe(
      "contact.companyRut == event.data.carrierRut"
    );
    expect(legacyWho("", "TRIP_CARRIER")).toBe(
      "contact.companyRut == event.data.carrierRut"
    );
    expect(legacyWho("Gerente de Seguridad", "TRIP_CARRIER")).toBe(
      "contact.role == 'Gerente de Seguridad' && contact.companyRut == event.data.carrierRut"
    );
  });

  it("reads any other role as that role of the book, and nothing as nobody", () => {
    expect(legacyWho("Jefe de torre", null)).toBe(
      "contact.role == 'Jefe de torre'"
    );
    expect(legacyWho("Jefe de torre", "ORG")).toBe(
      "contact.role == 'Jefe de torre'"
    );
    expect(legacyWho("  ", null)).toBe("");
  });

  it("writes conditions the form can show as clauses", () => {
    for (const who of [
      legacyWho("Conductor", null),
      legacyWho("Gerente", "TRIP_CARRIER"),
      legacyWho("Jefe", "ORG"),
    ]) {
      expect(parseClauses(who)).not.toBeNull();
    }
  });
});

describe("whoOf", () => {
  it("prefers the step's own condition over its older role", () => {
    expect(whoOf({ who: "'vip' in contact.tags", role: "Conductor" })).toBe(
      "'vip' in contact.tags"
    );
    expect(whoOf({ who: " ", role: "Jefe" })).toBe("contact.role == 'Jefe'");
  });
});

describe("summarizeWho", () => {
  it("names the role and whether the trip's driver or carrier is meant", () => {
    expect(summarizeWho(legacyWho("Conductor", null))).toEqual({
      role: "Conductor",
      driver: true,
      carrier: false,
    });
    expect(summarizeWho(legacyWho("Gerente", "TRIP_CARRIER"))).toEqual({
      role: "Gerente",
      driver: false,
      carrier: true,
    });
  });

  it("is null for a condition the clauses cannot say", () => {
    expect(
      summarizeWho("contact.role == 'A' || contact.role == 'B'")
    ).toBeNull();
  });
});
