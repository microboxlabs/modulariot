/**
 * The managed telephony plan and usage, as `TelephonyPlanDtos` in
 * miot-integrations serializes them. Prices are USD.
 */

export interface TelephonyPlan {
  minutesPerMonth: number;
  clMobileUsd: number;
  clLandlineUsd: number;
  otherUsd: number;
  whatsappCallUsd: number;
  whatsappTemplateUsd: number;
  enforced: boolean;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface TelephonySubscription {
  monthlyMinutes: number | null;
  updatedBy: string | null;
  updatedAt: string | null;
}

export interface TelephonyUsageLine {
  channel: "VOICE" | "WHATSAPP_CALL" | "WHATSAPP_TEMPLATE";
  destinationType: string;
  calls: number;
  seconds: number;
  billedMinutes: number;
  chargeUsd: number;
  providerCost: number | null;
}

export interface TelephonyUsage {
  periodStart: string;
  periodEnd: string;
  quotaMinutes: number;
  usedMinutes: number;
  /** Calls Telnyx has not confirmed yet. */
  pending: number;
  chargeUsd: number;
  providerCost: number | null;
  lines: TelephonyUsageLine[];
}

export interface OrgTelephonyUsage {
  tenantCode: string;
  subscription: TelephonySubscription | null;
  usage: TelephonyUsage;
}

export interface OrgTelephonyPlan {
  plan: TelephonyPlan;
  subscription: TelephonySubscription | null;
  usage: TelephonyUsage;
}

/** The form's fields, as typed. */
export type TelephonyPlanDraft = Record<
  | "minutesPerMonth"
  | "clMobileUsd"
  | "clLandlineUsd"
  | "otherUsd"
  | "whatsappCallUsd"
  | "whatsappTemplateUsd",
  string
> & { enforced: boolean };

export const PRICE_FIELDS = [
  "clMobileUsd",
  "clLandlineUsd",
  "otherUsd",
  "whatsappCallUsd",
  "whatsappTemplateUsd",
] as const;

export function telephonyPlanDraftFrom(
  plan: TelephonyPlan
): TelephonyPlanDraft {
  return {
    minutesPerMonth: String(plan.minutesPerMonth),
    clMobileUsd: String(plan.clMobileUsd ?? 0),
    clLandlineUsd: String(plan.clLandlineUsd ?? 0),
    otherUsd: String(plan.otherUsd ?? 0),
    whatsappCallUsd: String(plan.whatsappCallUsd ?? 0),
    whatsappTemplateUsd: String(plan.whatsappTemplateUsd ?? 0),
    enforced: plan.enforced,
  };
}

/** The request, or the first field that is not a number of zero or more. */
export function toTelephonyPlanRequest(
  draft: TelephonyPlanDraft
):
  | { ok: true; value: Omit<TelephonyPlan, "updatedBy" | "updatedAt"> }
  | { ok: false; field: keyof TelephonyPlanDraft } {
  const minutes = draft.minutesPerMonth.trim();
  if (!/^\d+$/.test(minutes)) return { ok: false, field: "minutesPerMonth" };
  const prices: Record<string, number> = {};
  for (const f of PRICE_FIELDS) {
    const text = draft[f].trim().replace(",", ".");
    const n = Number(text);
    if (text === "" || !Number.isFinite(n) || n < 0)
      return { ok: false, field: f };
    prices[f] = n;
  }
  return {
    ok: true,
    value: {
      minutesPerMonth: Number(minutes),
      clMobileUsd: prices.clMobileUsd,
      clLandlineUsd: prices.clLandlineUsd,
      otherUsd: prices.otherUsd,
      whatsappCallUsd: prices.whatsappCallUsd,
      whatsappTemplateUsd: prices.whatsappTemplateUsd,
      enforced: draft.enforced,
    },
  };
}

/** "" uses the plan's minutes (null); anything else must be a whole number. */
export function parseMonthlyMinutes(
  raw: string
): { ok: true; value: number | null } | { ok: false } {
  const text = raw.trim();
  if (text === "") return { ok: true, value: null };
  return /^\d+$/.test(text) ? { ok: true, value: Number(text) } : { ok: false };
}

export function usd(value: number | null | undefined): string {
  return value == null ? "—" : `US$ ${value.toFixed(2)}`;
}

/** The current month as YYYY-MM (UTC). */
export function currentMonth(now: Date = new Date()): string {
  return now.toISOString().slice(0, 7);
}
