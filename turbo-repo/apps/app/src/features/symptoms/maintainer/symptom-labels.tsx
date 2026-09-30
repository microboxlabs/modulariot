import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { SymptomState } from "./maintainer-api";

/** The four ICU levels, with the `Conditions` key `ConditionIcon` draws. */
export const ICU_LEVELS = [
  { icu: 1, condition: "under observation", nameKey: "under_observation" },
  {
    icu: 2,
    condition: "compromised condition",
    nameKey: "compromised_condition",
  },
  { icu: 3, condition: "critical condition", nameKey: "critical_condition" },
  { icu: 4, condition: "code black", nameKey: "code_black" },
] as const;

const STATE_KEY: Record<SymptomState, string> = {
  ACTIVE: "stateActive",
  TEST: "stateTest",
  OFF: "stateOff",
};

export function stateLabel(state: SymptomState, d: I18nRecord) {
  return trDynamic(STATE_KEY[state], d);
}

/** `driving_safety` → `Driving safety`, until families come from their selectable. */
export function familyLabel(family: string | null) {
  if (!family) return "";
  const text = family.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
