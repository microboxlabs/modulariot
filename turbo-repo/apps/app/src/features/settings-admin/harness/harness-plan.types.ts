import type { HarnessPlan } from "../platform/platform.types";

export type BillingCycle = "monthly" | "yearly";

export type AccessMode = "all" | "some" | "none";

/** Mirrors `HarnessPlanDtos.Subscription`. `members` are lowercase emails. */
export interface HarnessSubscription {
  seats: number;
  billingCycle: BillingCycle;
  accessMode: AccessMode;
  members: string[];
  updatedBy: string | null;
  updatedAt: string | null;
}

/** Mirrors `HarnessPlanDtos.SetSubscriptionRequest`. */
export interface SetHarnessSubscription {
  seats: number;
  billingCycle: BillingCycle;
  accessMode: AccessMode;
  members: string[];
}

/**
 * Mirrors `HarnessPlanDtos.PoolUse`: `key` is a member's email, or a model as
 * runs name it. `poolTokens` is `tokens` times the model's multiplier.
 */
export interface PoolUse {
  key: string;
  runs: number;
  tokens: number;
  poolTokens: number;
}

/** Mirrors `HarnessPlanDtos.Pool`: the current calendar month, UTC. */
export interface HarnessPool {
  periodStart: string;
  periodEnd: string;
  included: number;
  used: number;
  byMember: PoolUse[];
  byModel: PoolUse[];
}

/** Mirrors `HarnessPlanDtos.OrgPlanResponse`. */
export interface OrgHarnessPlan {
  plan: HarnessPlan;
  subscription: HarnessSubscription | null;
  pool: HarnessPool;
  /** False while the modulith records usage without refusing runs. */
  enforced: boolean;
}
