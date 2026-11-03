import { describe, expect, it } from "vitest";
import type { TowerContact } from "@/features/symptoms/control-tower/control-tower-api";
import { contactMethods, driverMethods, stepMethod } from "./call-targets";

const contact = (patch: Partial<TowerContact>): TowerContact =>
  ({
    id: "c1",
    name: "Luis",
    phone: null,
    methods: [],
    channels: null,
    ...patch,
  }) as TowerContact;

describe("contactMethods", () => {
  it("is empty for a contact with no channels", () => {
    expect(contactMethods(contact({}))).toEqual([]);
  });

  it("needs a phone number for phone and WhatsApp", () => {
    expect(contactMethods(contact({ methods: ["PHONE", "WHATSAPP"] }))).toEqual(
      []
    );
    expect(
      contactMethods(
        contact({ methods: ["PHONE", "WHATSAPP"], phone: "+56911112222" })
      )
    ).toEqual(["phone", "whatsapp"]);
    expect(
      contactMethods(
        contact({
          methods: ["WHATSAPP"],
          channels: { whatsapp: "+56911112222" },
        })
      )
    ).toEqual(["whatsapp"]);
  });

  it("needs the account for Meet and Teams, and the channel allowed", () => {
    expect(contactMethods(contact({ methods: ["TEAMS"] }))).toEqual([]);
    expect(
      contactMethods(
        contact({ methods: ["TEAMS"], channels: { teams: "ana@example.com" } })
      )
    ).toEqual(["teams"]);
    expect(
      contactMethods(
        contact({ methods: [], channels: { meet: "ana@example.com" } })
      )
    ).toEqual([]);
  });
});

describe("driverMethods", () => {
  it("offers phone and WhatsApp only with a number", () => {
    expect(driverMethods("+56 9 3333 4444")).toEqual(["phone", "whatsapp"]);
    expect(driverMethods("")).toEqual([]);
    expect(driverMethods(null)).toEqual([]);
    expect(driverMethods(undefined)).toEqual([]);
  });
});

describe("stepMethod", () => {
  it("maps a step's channel to a call channel", () => {
    expect(stepMethod("call")).toBe("phone");
    expect(stepMethod("whatsapp")).toBe("whatsapp");
    expect(stepMethod("teams")).toBe("teams");
    expect(stepMethod("email")).toBeNull();
  });
});
