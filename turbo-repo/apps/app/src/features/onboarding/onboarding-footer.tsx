"use client";

import Link from "next/link";
import { Button } from "flowbite-react";
import { FaArrowLeft, FaArrowRight } from "react-icons/fa";
import { ONBOARDING_STEPS, OnboardingStepId } from "./onboarding-steps";

const ENABLED_STEPS = ONBOARDING_STEPS.filter((step) => !step.disabled);

export default function OnboardingFooter({
  lang,
  currentStep,
  profileId,
  onFinish,
}: Readonly<{
  lang: string;
  currentStep: OnboardingStepId;
  profileId: string;
  onFinish: () => void;
}>) {
  const currentIndex = ENABLED_STEPS.findIndex(
    (step) => step.id === currentStep
  );
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === ENABLED_STEPS.length - 1;
  const previousStep = ENABLED_STEPS[currentIndex - 1];
  const nextStep = ENABLED_STEPS[currentIndex + 1];

  return (
    <div className="flex items-center justify-between w-full px-6 py-4 border-t border-gray-200 dark:border-gray-700">
      {isFirst ? (
        <span />
      ) : (
        // No explicit key: swapping between <span> and <Button> here already
        // forces a remount (different element types), so this only fades in
        // exactly when Back actually appears — not on every step change.
        <Button
          as={Link}
          href={`/${lang}/onboarding?step=${previousStep.id}&profile=${profileId}`}
          color="light"
          className="animate-fade-in-opacity"
        >
          <span className="flex items-center gap-2">
            <FaArrowLeft className="w-4 h-4" />
            Back
          </span>
        </Button>
      )}
      {isLast ? (
        <Button
          key="finish"
          type="button"
          color="blue"
          className="animate-fade-in-opacity"
          onClick={onFinish}
        >
          <span className="flex items-center gap-2">
            Finish
            <FaArrowRight className="w-4 h-4" />
          </span>
        </Button>
      ) : (
        // Both branches render a <Button>, so an explicit key keyed on
        // isLast is needed — otherwise React reuses the same instance across
        // every step change instead of remounting only when Next <-> Finish.
        <Button
          key="next"
          as={Link}
          href={`/${lang}/onboarding?step=${nextStep.id}&profile=${profileId}`}
          color="blue"
          className="animate-fade-in-opacity"
        >
          <span className="flex items-center gap-2">
            Next
            <FaArrowRight className="w-4 h-4" />
          </span>
        </Button>
      )}
    </div>
  );
}
