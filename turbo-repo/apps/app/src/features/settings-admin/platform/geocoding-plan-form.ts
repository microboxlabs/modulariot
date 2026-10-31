import type {
  GeocodingPlan,
  GeocodingSubscription,
  OnExhausted,
  SetGeocodingPlan,
  SetGeocodingSubscription,
} from "@/features/geocoding/geocoding-plan.types";

/** The plan as typed. */
export interface GeocodingPlanDraft {
  monthlyPriceUsd: string;
  resolutionsPerMonth: string;
  overagePriceUsd: string;
  alertPct: string;
  enforced: boolean;
  whatsAppRecipients: string;
}

/** Keys under `errors` in the dictionary. */
export type GeocodingPlanError =
  | "monthlyPrice"
  | "resolutions"
  | "overagePrice"
  | "alertPct"
  | "quota"
  | "whatsAppRecipients";

export type DraftResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: GeocodingPlanError };

export function geocodingPlanDraftFrom(
  plan: GeocodingPlan
): GeocodingPlanDraft {
  return {
    monthlyPriceUsd: String(plan.monthlyPriceUsd),
    resolutionsPerMonth: String(plan.resolutionsPerMonth),
    overagePriceUsd: String(plan.overagePriceUsd),
    alertPct: String(plan.alertPct),
    enforced: plan.enforced,
    whatsAppRecipients: (plan.whatsAppRecipients ?? []).join("\n"),
  };
}

function number(value: string): number | undefined {
  const text = value.trim();
  if (text === "") return undefined;
  const n = Number(text);
  return Number.isFinite(n) ? n : undefined;
}

function wholeCount(value: string): number | undefined {
  const n = number(value);
  return n !== undefined && Number.isInteger(n) && n >= 0 ? n : undefined;
}

function recipients(value: string): string[] | undefined {
  const phones = value.split(/[\s,;]+/).filter(Boolean);
  if (
    phones.length > 20 ||
    phones.some((phone) => !/^\+[1-9][0-9]{6,14}$/.test(phone))
  ) {
    return undefined;
  }
  return [...new Set(phones)];
}

/** The request body for a draft, or the first problem with it. */
export function toGeocodingPlanRequest(
  draft: GeocodingPlanDraft
): DraftResult<SetGeocodingPlan> {
  const monthlyPriceUsd = number(draft.monthlyPriceUsd);
  if (monthlyPriceUsd === undefined || monthlyPriceUsd < 0) {
    return { ok: false, error: "monthlyPrice" };
  }
  const resolutionsPerMonth = wholeCount(draft.resolutionsPerMonth);
  if (resolutionsPerMonth === undefined) {
    return { ok: false, error: "resolutions" };
  }
  const overagePriceUsd = number(draft.overagePriceUsd);
  if (overagePriceUsd === undefined || overagePriceUsd < 0) {
    return { ok: false, error: "overagePrice" };
  }
  const alertPct = wholeCount(draft.alertPct);
  if (alertPct === undefined || alertPct < 1 || alertPct > 100) {
    return { ok: false, error: "alertPct" };
  }
  const whatsAppRecipients = recipients(draft.whatsAppRecipients);
  if (whatsAppRecipients === undefined) {
    return { ok: false, error: "whatsAppRecipients" };
  }
  return {
    ok: true,
    value: {
      monthlyPriceUsd,
      resolutionsPerMonth,
      overagePriceUsd,
      alertPct,
      enforced: draft.enforced,
      whatsAppRecipients,
    },
  };
}

/** One organization's subscription as typed. An empty quota uses the plan's. */
export interface SubscriptionDraft {
  monthlyQuota: string;
  onExhausted: OnExhausted;
  whatsAppRecipients: string;
}

export function subscriptionDraftFrom(
  subscription: GeocodingSubscription | null
): SubscriptionDraft {
  return {
    monthlyQuota:
      subscription?.monthlyQuota == null
        ? ""
        : String(subscription.monthlyQuota),
    onExhausted: subscription?.onExhausted ?? "review",
    whatsAppRecipients: (subscription?.whatsAppRecipients ?? []).join("\n"),
  };
}

export function toSubscriptionRequest(
  draft: SubscriptionDraft
): DraftResult<SetGeocodingSubscription> {
  const whatsAppRecipients = recipients(draft.whatsAppRecipients);
  if (whatsAppRecipients === undefined) {
    return { ok: false, error: "whatsAppRecipients" };
  }
  if (draft.monthlyQuota.trim() === "") {
    return {
      ok: true,
      value: {
        monthlyQuota: null,
        onExhausted: draft.onExhausted,
        whatsAppRecipients,
      },
    };
  }
  const monthlyQuota = wholeCount(draft.monthlyQuota);
  if (monthlyQuota === undefined) {
    return { ok: false, error: "quota" };
  }
  return {
    ok: true,
    value: { monthlyQuota, onExhausted: draft.onExhausted, whatsAppRecipients },
  };
}
