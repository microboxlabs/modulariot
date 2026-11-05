import { describe, expect, it } from "vitest";
import {
  currentMonth,
  parseMonthlyMinutes,
  telephonyPlanDraftFrom,
  toTelephonyPlanRequest,
  usd,
} from "./telephony-plan";

const plan = {
  minutesPerMonth: 300,
  clMobileUsd: 0.05,
  clLandlineUsd: 0.03,
  otherUsd: 0.2,
  whatsappCallUsd: 0.02,
  whatsappTemplateUsd: 0.04,
  enforced: false,
  updatedBy: null,
  updatedAt: null,
};

describe("telephony plan form", () => {
  it("round-trips the plan", () => {
    const req = toTelephonyPlanRequest(telephonyPlanDraftFrom(plan));
    expect(req).toEqual({
      ok: true,
      value: {
        minutesPerMonth: 300,
        clMobileUsd: 0.05,
        clLandlineUsd: 0.03,
        otherUsd: 0.2,
        whatsappCallUsd: 0.02,
        whatsappTemplateUsd: 0.04,
        enforced: false,
      },
    });
  });

  it("names the first bad field and accepts a decimal comma", () => {
    const draft = telephonyPlanDraftFrom(plan);
    expect(
      toTelephonyPlanRequest({ ...draft, minutesPerMonth: "1.5" })
    ).toEqual({ ok: false, field: "minutesPerMonth" });
    expect(toTelephonyPlanRequest({ ...draft, otherUsd: "-1" })).toEqual({
      ok: false,
      field: "otherUsd",
    });
    const comma = toTelephonyPlanRequest({ ...draft, clMobileUsd: "0,07" });
    expect(comma.ok && comma.value.clMobileUsd).toBe(0.07);
  });

  it("parses an organization's minutes", () => {
    expect(parseMonthlyMinutes("")).toEqual({ ok: true, value: null });
    expect(parseMonthlyMinutes(" 120 ")).toEqual({ ok: true, value: 120 });
    expect(parseMonthlyMinutes("ten")).toEqual({ ok: false });
  });

  it("formats money and the month", () => {
    expect(usd(1.234)).toBe("US$ 1.23");
    expect(usd(null)).toBe("—");
    expect(currentMonth(new Date("2026-11-04T10:00:00Z"))).toBe("2026-11");
  });
});
