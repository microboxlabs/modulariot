import { describe, expect, it } from "vitest";
import {
  geocodingPlanDraftFrom,
  subscriptionDraftFrom,
  toGeocodingPlanRequest,
  toSubscriptionRequest,
} from "./geocoding-plan-form";

const PLAN = {
  monthlyPriceUsd: 0,
  resolutionsPerMonth: 1000,
  overagePriceUsd: 0.005,
  alertPct: 80,
  enforced: false,
  updatedBy: null,
  updatedAt: null,
};

describe("toGeocodingPlanRequest", () => {
  it("keeps the plan as it was loaded, enforcement included", () => {
    const draft = { ...geocodingPlanDraftFrom(PLAN), enforced: true };

    expect(toGeocodingPlanRequest(draft)).toEqual({
      ok: true,
      value: {
        monthlyPriceUsd: 0,
        resolutionsPerMonth: 1000,
        overagePriceUsd: 0.005,
        alertPct: 80,
        enforced: true,
      },
    });
  });

  it("names the first invalid field", () => {
    const draft = geocodingPlanDraftFrom(PLAN);

    expect(toGeocodingPlanRequest({ ...draft, monthlyPriceUsd: "-1" })).toEqual(
      { ok: false, error: "monthlyPrice" }
    );
    expect(
      toGeocodingPlanRequest({ ...draft, resolutionsPerMonth: "10.5" })
    ).toEqual({ ok: false, error: "resolutions" });
    expect(toGeocodingPlanRequest({ ...draft, overagePriceUsd: "" })).toEqual({
      ok: false,
      error: "overagePrice",
    });
    expect(toGeocodingPlanRequest({ ...draft, alertPct: "0" })).toEqual({
      ok: false,
      error: "alertPct",
    });
  });
});

describe("toSubscriptionRequest", () => {
  it("sends no quota when the field is empty, so the plan's applies", () => {
    expect(toSubscriptionRequest(subscriptionDraftFrom(null))).toEqual({
      ok: true,
      value: { monthlyQuota: null, onExhausted: "review" },
    });
  });

  it("sends a whole quota and refuses anything else", () => {
    const draft = subscriptionDraftFrom({
      monthlyQuota: 500,
      onExhausted: "overage",
      updatedBy: null,
      updatedAt: null,
    });

    expect(toSubscriptionRequest(draft)).toEqual({
      ok: true,
      value: { monthlyQuota: 500, onExhausted: "overage" },
    });
    expect(toSubscriptionRequest({ ...draft, monthlyQuota: "-3" })).toEqual({
      ok: false,
      error: "quota",
    });
  });
});
