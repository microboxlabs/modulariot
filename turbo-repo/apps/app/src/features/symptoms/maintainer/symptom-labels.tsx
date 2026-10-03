import type { I18nRecord } from "@/features/i18n/i18n.service.types";
import { trDynamic } from "@/features/i18n/tr.service";
import type { SymptomFamily, SymptomState } from "./maintainer-api";

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

/**
 * The family value a stored family stands for. Older symptoms may hold a
 * family's label (such as "Seguridad de conducción") instead of its value.
 */
export function canonicalFamily(
  family: string | null | undefined,
  families?: readonly SymptomFamily[]
) {
  if (!family) return null;
  const known = families?.find(
    (f) => f.value === family || Object.values(f.label).includes(family)
  );
  return known?.value ?? family;
}

/**
 * A family's label in the page's language, from the organization's families.
 * A value no family has (an older free-text one) reads as itself:
 * `driving_safety` → `Driving safety`.
 */
export function familyLabel(
  family: string | null | undefined,
  families?: readonly SymptomFamily[],
  lang = "es"
) {
  if (!family) return "";
  const value = canonicalFamily(family, families);
  const known = families?.find((f) => f.value === value);
  const label = known?.label[lang] ?? known?.label.es;
  if (label) return label;
  const text = family.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
