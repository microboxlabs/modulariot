import { MiotHarnessApiError } from "@microboxlabs/miot-harness-client";

/** The seat-plan refusals the modulith sends, and the chat message for each. */
const PLAN_MESSAGES = {
  plan_no_subscription: "harnessChat.plan.plan_no_subscription",
  plan_no_seat: "harnessChat.plan.plan_no_seat",
  plan_pool_exhausted: "harnessChat.plan.plan_pool_exhausted",
  plan_model_not_offered: "harnessChat.plan.plan_model_not_offered",
} as const;

export type PlanRefusalMessage =
  (typeof PLAN_MESSAGES)[keyof typeof PLAN_MESSAGES];

/** The message to show when the modulith refused the run for the seat plan, else null. */
export function planRefusalMessage(err: unknown): PlanRefusalMessage | null {
  if (!(err instanceof MiotHarnessApiError)) return null;
  const body = err.body;
  if (typeof body !== "object" || body === null) return null;
  const code = body.error;
  return typeof code === "string" && Object.hasOwn(PLAN_MESSAGES, code)
    ? PLAN_MESSAGES[code as keyof typeof PLAN_MESSAGES]
    : null;
}
