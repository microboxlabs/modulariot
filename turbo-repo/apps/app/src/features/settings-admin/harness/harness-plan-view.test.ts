import { describe, expect, it } from "vitest";
import {
  activeCount,
  billingTotal,
  formatTokens,
  normalizeEmail,
  poolPercent,
  seatPriceFor,
} from "./harness-plan-view";

const PLAN = {
  seatPriceUsd: 25,
  tokensPerSeat: 10_000_000,
  yearlyDiscountPct: 20,
  updatedBy: null,
  updatedAt: null,
};

describe("seat prices", () => {
  it("discounts only the yearly cycle", () => {
    expect(seatPriceFor(PLAN, "monthly")).toBe(25);
    expect(seatPriceFor(PLAN, "yearly")).toBe(20);
  });

  it("charges twelve discounted months for a yearly cycle", () => {
    expect(billingTotal(10, PLAN, "monthly")).toBe(250);
    expect(billingTotal(10, PLAN, "yearly")).toBe(2400);
  });
});

describe("activeCount", () => {
  it("follows the access mode", () => {
    expect(activeCount("all", 12, 3)).toBe(12);
    expect(activeCount("some", 12, 3)).toBe(3);
    expect(activeCount("none", 12, 3)).toBe(0);
  });
});

describe("formatTokens", () => {
  it("abbreviates millions and thousands", () => {
    expect(formatTokens(12_500_000)).toBe("12.5M");
    expect(formatTokens(10_000_000)).toBe("10M");
    expect(formatTokens(800_400)).toBe("800K");
    expect(formatTokens(950)).toBe("950");
  });
});

describe("poolPercent", () => {
  it("caps at 100 and treats an empty pool as full once used", () => {
    expect(poolPercent(5, 10)).toBe(50);
    expect(poolPercent(20, 10)).toBe(100);
    expect(poolPercent(0, 0)).toBe(0);
    expect(poolPercent(1, 0)).toBe(100);
  });
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail(" Alice@Acme.Test ")).toBe("alice@acme.test");
  });
});
