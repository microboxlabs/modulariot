import { describe, expect, it } from "vitest";
import {
  planDraftFrom,
  toPlanRequest,
  yearlySeatPrice,
} from "./harness-plan-form";

describe("toPlanRequest", () => {
  it("turns millions of tokens into tokens", () => {
    expect(
      toPlanRequest({
        seatPriceUsd: "25",
        tokensPerSeatMillions: "10",
        yearlyDiscountPct: "20",
      })
    ).toEqual({
      ok: true,
      value: {
        seatPriceUsd: 25,
        tokensPerSeat: 10_000_000,
        yearlyDiscountPct: 20,
      },
    });
  });

  it.each([
    [{ seatPriceUsd: "-1" }, "seatPrice"],
    [{ seatPriceUsd: "" }, "seatPrice"],
    [{ tokensPerSeatMillions: "abc" }, "tokensPerSeat"],
    [{ yearlyDiscountPct: "100" }, "yearlyDiscount"],
  ] as const)("refuses %j with %s", (patch, error) => {
    const draft = {
      seatPriceUsd: "25",
      tokensPerSeatMillions: "10",
      yearlyDiscountPct: "20",
      ...patch,
    };
    expect(toPlanRequest(draft)).toEqual({ ok: false, error });
  });
});

describe("planDraftFrom", () => {
  it("shows tokens per seat in millions", () => {
    expect(
      planDraftFrom({
        seatPriceUsd: 25,
        tokensPerSeat: 12_500_000,
        yearlyDiscountPct: 20,
        updatedBy: null,
        updatedAt: null,
      }).tokensPerSeatMillions
    ).toBe("12.5");
  });
});

describe("yearlySeatPrice", () => {
  it("applies the discount and rounds to cents", () => {
    expect(yearlySeatPrice(25, 20)).toBe(20);
    expect(yearlySeatPrice(19.99, 15)).toBe(16.99);
  });
});
