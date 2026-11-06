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
  tags: [],
  places: [],
};

describe("summarizeWho", () => {
  it("reads a role and the trip's origin in the tags as that role of the origin", () => {
    expect(
      summarizeWho("contact.role == 'CAT' && event.data.origin in contact.tags")
    ).toEqual({ ...NONE, role: "CAT", roles: ["CAT"], places: ["origin"] });
    expect(
      summarizeWho(
        "contact.roleKey == 'cat' && has(event.data.originKey) && event.data.originKey in contact.tagKeys"
      )
    ).toEqual({ ...NONE, role: "cat", roles: ["cat"], places: ["origin"] });
    expect(
      summarizeWho(
        "event.data.destinationKey in contact.tagKeys && event.data.originKey in contact.tagKeys"
      )
    ).toEqual({ ...NONE, places: ["destination", "origin"] });
  });

  it("does not read a place key compared with the tags as written", () => {
    expect(summarizeWho("event.data.originKey in contact.tags")).toBeNull();
    expect(summarizeWho("event.data.origin in contact.tagKeys")).toBeNull();
  });

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

  it("keeps quoted operators and required tags", () => {
    expect(
      summarizeWho(
        "contact.role == 'Supervisor' && contact.company == 'Uno && Dos' && 'night' in contact.tags"
      )
    ).toEqual({
      ...NONE,
      role: "Supervisor",
      roles: ["Supervisor"],
      company: "Uno && Dos",
      tags: ["night"],
    });
  });

  it.each([
    String.raw`\u0053`,
    String.raw`\U00000053`,
    String.raw`\x53`,
    String.raw`\123`,
  ])("decodes CEL escapes in roles: %s", (escape) => {
    const who = `contact.role == '${escape}upervisor'`;
    expect(summarizeWho(who)?.roles).toEqual(["Supervisor"]);
    expect(rolesIn(who + " && contact.position.startsWith('x')")).toEqual([
      "Supervisor",
    ]);
  });

  it.each([String.raw`\uD800`, String.raw`\U00110000`, String.raw`\q`])(
    "leaves unsupported literals unreadable: %s",
    (escape) => {
      expect(summarizeWho(`contact.role == '${escape}'`)).toBeNull();
    }
  );

  it("does not associate an OR branch with a later AND constraint", () => {
    expect(
      summarizeWho(
        "contact.role == 'Supervisor' || contact.role == 'Despachador' && contact.companyRut == event.data.carrierRut"
      )
    ).toBeNull();
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

  it.each([
    `contact.position == "contact.role == 'Supervisor'"`,
    `contact.position == """contact.role == 'Supervisor'"""`,
    "!(contact.role == 'Supervisor') && contact.company == 'Empresa Uno'",
    "contact.position == 'x' // contact.role == 'Supervisor'",
  ])("does not extract quoted, commented or negated roles: %s", (who) => {
    expect(rolesIn(who)).toEqual([]);
  });

  it("scans long strings with escaped quotes without treating their suffixes as roles", () => {
    const literal = String.raw`\"`.repeat(10000);
    expect(
      rolesIn(
        `contact.position == "${literal}" && contact.role == 'Supervisor'`
      )
    ).toEqual(["Supervisor"]);
  });

  it("keeps a positive role outside a negated comparison", () => {
    expect(
      rolesIn(
        "!(contact.role == 'Despachador') && contact.role == 'Supervisor'"
      )
    ).toEqual(["Supervisor"]);
  });
});
