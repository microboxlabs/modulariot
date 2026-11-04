import { describe, expect, it } from "vitest";
import {
  e164,
  isTelephonyProvider,
  telephonyMetadata,
  telephonyProblem,
  telephonyValues,
} from "./telephony-connection";

describe("telephony connections", () => {
  it("accepts E.164 with separators and rejects the rest", () => {
    expect(e164("+56 9 0000 0000")).toBe("+56900000000");
    expect(e164("(+56) 9-0000-0000")).toBe("+56900000000");
    expect(e164("56900000000")).toBeNull();
    expect(e164("+0123")).toBeNull();
  });

  it("knows its two providers", () => {
    expect(isTelephonyProvider("TELNYX")).toBe(true);
    expect(isTelephonyProvider("TEAMS_PHONE")).toBe(true);
    expect(isTelephonyProvider("WHATSAPP")).toBe(false);
    expect(isTelephonyProvider(undefined)).toBe(false);
  });

  it("Telnyx needs the SIP connection and a caller number", () => {
    const empty = telephonyValues(undefined);
    expect(telephonyProblem("TELNYX", empty)).toBe(
      "telephony.sipConnectionIdRequired"
    );
    expect(
      telephonyProblem("TELNYX", { ...empty, sipConnectionId: "sip-1" })
    ).toBe("telephony.callerNumberInvalid");
    const ok = {
      ...empty,
      sipConnectionId: " sip-1 ",
      callerNumber: "+56 9 0000 0000",
    };
    expect(telephonyProblem("TELNYX", ok)).toBeNull();
    expect(telephonyMetadata("TELNYX", ok)).toEqual({
      sipConnectionId: "sip-1",
      callerNumber: "+56900000000",
    });
  });

  it("Teams' caller id is optional", () => {
    const empty = telephonyValues({});
    expect(telephonyProblem("TEAMS_PHONE", empty)).toBeNull();
    expect(telephonyMetadata("TEAMS_PHONE", empty)).toEqual({});
    expect(
      telephonyProblem("TEAMS_PHONE", { ...empty, defaultCallerId: "123" })
    ).toBe("telephony.callerNumberInvalid");
    expect(
      telephonyMetadata(
        "TEAMS_PHONE",
        telephonyValues({ defaultCallerId: "+56 2 0000 0000" })
      )
    ).toEqual({ defaultCallerId: "+56200000000" });
  });
});
