import { describe, expect, it } from "vitest";
import type { TowerContact } from "@/features/symptoms/control-tower/control-tower-api";
import {
  contactMethods,
  isTripDriver,
  phoneForMethod,
  stepMethod,
  tripPhoneBody,
  tripPhoneE164,
} from "./call-targets";

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
        contact({ methods: ["PHONE", "WHATSAPP"], phone: "+12025550101" })
      )
    ).toEqual(["phone", "whatsapp"]);
    expect(
      contactMethods(
        contact({
          methods: ["WHATSAPP"],
          channels: { whatsapp: "+12025550101" },
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

describe("stepMethod", () => {
  it("maps a step's channel to a call channel", () => {
    expect(stepMethod("call")).toBe("phone");
    expect(stepMethod("whatsapp")).toBe("whatsapp");
    expect(stepMethod("teams")).toBe("teams");
    expect(stepMethod("email")).toBeNull();
  });
});

describe("phoneForMethod", () => {
  it("keeps the selected WhatsApp number in the displayed and recorded target", () => {
    const target = {
      phone: "+12025550101",
      channels: { phone: "+12025550102", whatsapp: "+12025550103" },
    };
    expect(phoneForMethod(target, "phone")).toBe("+12025550102");
    expect(phoneForMethod(target, "whatsapp")).toBe("+12025550103");
    expect(phoneForMethod({ phone: target.phone }, "whatsapp")).toBe(
      target.phone
    );
  });
});

describe("tripPhoneE164", () => {
  it("reads a national number as Chilean and returns E.164", () => {
    expect(tripPhoneE164("+56 9 0000 0000")).toBe("+56900000000");
    expect(tripPhoneE164("9 0000 0000")).toBe("+56900000000");
  });

  it("is null for an empty or invalid number", () => {
    expect(tripPhoneE164(undefined)).toBeNull();
    expect(tripPhoneE164("  ")).toBeNull();
    expect(tripPhoneE164("123")).toBeNull();
  });
});

describe("isTripDriver", () => {
  it("compares national ids without dots or dashes, ignoring case", () => {
    expect(isTripDriver({ nationalId: "00.000.001-k" }, "00000001K")).toBe(
      true
    );
    expect(isTripDriver({ nationalId: "000000019" }, "000000027")).toBe(false);
    expect(isTripDriver({ nationalId: null }, undefined)).toBe(false);
  });
});

describe("tripPhoneBody", () => {
  it("adds phone and WhatsApp once and keeps the other channels", () => {
    expect(
      tripPhoneBody(
        { methods: ["PHONE", "TEAMS"], channels: { teams: "ana@example.com" } },
        "+56900000000"
      )
    ).toEqual({
      phone: "+56900000000",
      methods: ["PHONE", "TEAMS", "WHATSAPP"],
      channels: {
        teams: "ana@example.com",
        phone: "+56900000000",
        whatsapp: "+56900000000",
      },
    });
  });
});
