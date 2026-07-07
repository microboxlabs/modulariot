export const ONBOARDING_STEPS = [
  { id: "profile", label: "Profile", disabled: false },
  { id: "vital-signs", label: "Vital signs", disabled: false },
  { id: "activate", label: "Activate", disabled: true },
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEPS)[number]["id"];

export function isOnboardingStepId(
  value: string | undefined
): value is OnboardingStepId {
  return ONBOARDING_STEPS.some((step) => step.id === value);
}
