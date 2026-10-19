import type { HarnessPlan, SetHarnessPlan } from "./platform.types";

/** The plan as typed. Tokens per seat is entered in millions. */
export interface PlanDraft {
  seatPriceUsd: string;
  tokensPerSeatMillions: string;
  yearlyDiscountPct: string;
}

/** Keys under `plan.errors` in the dictionary. */
export type PlanDraftError = "seatPrice" | "tokensPerSeat" | "yearlyDiscount";

export type PlanDraftResult =
  | { ok: true; value: SetHarnessPlan }
  | { ok: false; error: PlanDraftError };

const MILLION = 1_000_000;

export function planDraftFrom(plan: HarnessPlan): PlanDraft {
  return {
    seatPriceUsd: String(plan.seatPriceUsd),
    tokensPerSeatMillions: String(plan.tokensPerSeat / MILLION),
    yearlyDiscountPct: String(plan.yearlyDiscountPct),
  };
}

function number(value: string): number | undefined {
  const text = value.trim();
  if (text === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

/** The request body for a draft, or the first problem with it. */
export function toPlanRequest(draft: PlanDraft): PlanDraftResult {
  const seatPriceUsd = number(draft.seatPriceUsd);
  if (seatPriceUsd === undefined || seatPriceUsd < 0) {
    return { ok: false, error: "seatPrice" };
  }
  const millions = number(draft.tokensPerSeatMillions);
  if (millions === undefined || millions < 0) {
    return { ok: false, error: "tokensPerSeat" };
  }
  const yearlyDiscountPct = number(draft.yearlyDiscountPct);
  if (
    yearlyDiscountPct === undefined ||
    yearlyDiscountPct < 0 ||
    yearlyDiscountPct >= 100
  ) {
    return { ok: false, error: "yearlyDiscount" };
  }
  return {
    ok: true,
    value: {
      seatPriceUsd,
      tokensPerSeat: Math.round(millions * MILLION),
      yearlyDiscountPct,
    },
  };
}

/** The per-seat monthly price when billed yearly, rounded to cents. */
export function yearlySeatPrice(
  seatPriceUsd: number,
  yearlyDiscountPct: number
): number {
  return Math.round(seatPriceUsd * (100 - yearlyDiscountPct)) / 100;
}
