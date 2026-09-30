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

const STATE_CLASS: Record<SymptomState, string> = {
  ACTIVE:
    "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  TEST: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  OFF: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

const STATE_KEY: Record<SymptomState, string> = {
  ACTIVE: "stateActive",
  TEST: "stateTest",
  OFF: "stateOff",
};

export function stateLabel(state: SymptomState, d: I18nRecord) {
  return trDynamic(STATE_KEY[state], d);
}

export function StateBadge({
  state,
  d,
}: Readonly<{ state: SymptomState; d: I18nRecord }>) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${STATE_CLASS[state]}`}
    >
      {stateLabel(state, d)}
    </span>
  );
}

/** `driving_safety` → `Driving safety`, until families come from their selectable. */
export function familyLabel(family: string | null) {
  if (!family) return "";
  const text = family.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
