import Link from "next/link";
import { HiCheck } from "react-icons/hi2";
import { ONBOARDING_STEPS, OnboardingStepId } from "./onboarding-steps";

export default function OnboardingHeader({
  lang,
  currentStep,
  profileId,
}: {
  lang: string;
  currentStep: OnboardingStepId;
  profileId: string;
}) {
  const currentIndex = ONBOARDING_STEPS.findIndex(
    (step) => step.id === currentStep
  );

  return (
    <div className="flex items-center justify-between w-full px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-6">
        {ONBOARDING_STEPS.map((step, index) => {
          const isSelected = step.id === currentStep;
          const isPassed = index < currentIndex;

          const badge = (
            <span
              className={`flex items-center justify-center w-6 h-6 rounded-full border text-xs transition-colors duration-200 ${
                step.disabled
                  ? "border-gray-200 text-gray-300 dark:border-gray-700 dark:text-gray-700"
                  : isSelected
                    ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                    : "border-gray-300 text-gray-400 dark:border-gray-600 dark:text-gray-500"
              }`}
            >
              {isPassed ? (
                <HiCheck
                  key="check"
                  className="w-3.5 h-3.5 animate-step-complete"
                />
              ) : (
                <span key="number" className="animate-fade-in-opacity">
                  {index + 1}
                </span>
              )}
            </span>
          );

          return (
            <div key={step.id} className="flex items-center gap-6">
              {step.disabled ? (
                <span className="flex items-center gap-2 text-sm font-medium text-gray-300 cursor-not-allowed dark:text-gray-700">
                  {badge}
                  {step.label}
                </span>
              ) : (
                <Link
                  href={`/${lang}/onboarding?step=${step.id}&profile=${profileId}`}
                  className={`flex items-center gap-2 text-sm font-medium transition-colors duration-200 ${
                    isSelected
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {badge}
                  {step.label}
                </Link>
              )}
              {index < ONBOARDING_STEPS.length - 1 && (
                <span className="text-gray-300 dark:text-gray-600">-</span>
              )}
            </div>
          );
        })}
      </div>
      <Link
        href={`/${lang}/home`}
        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 cursor-pointer"
      >
        Skip
      </Link>
    </div>
  );
}
