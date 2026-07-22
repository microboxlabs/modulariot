import { SearchParams } from "next/dist/server/request/search-params";
import { ParamsWithLang } from "@/features/i18n/i18n.service.types";
import OnboardingWelcome from "@/features/onboarding/onboarding-welcome";
import OnboardingStepper from "@/features/onboarding/onboarding-stepper";
import { isOnboardingStepId } from "@/features/onboarding/onboarding-steps";
import {
  DEFAULT_PROFILE_ID,
  isProfileId,
} from "@/features/vital-signs/vital-signs-data";

export default async function OnboardingPage({
  params,
  searchParams,
}: ParamsWithLang & { searchParams: Promise<SearchParams> }) {
  const { lang } = await params;
  const resolvedSearchParams = await searchParams;
  const stepParam = resolvedSearchParams?.step;
  const step = typeof stepParam === "string" ? stepParam : undefined;
  const profileParam = resolvedSearchParams?.profile;
  const profileId =
    typeof profileParam === "string" && isProfileId(profileParam)
      ? profileParam
      : DEFAULT_PROFILE_ID;

  return (
    <div className="w-screen h-screen bg-gray-50 dark:bg-gray-900">
      <div
        key={step ? "stepper" : "welcome"}
        className="w-full h-full animate-fade-in-opacity"
      >
        {step && isOnboardingStepId(step) ? (
          <OnboardingStepper lang={lang} currentStep={step} profileId={profileId} />
        ) : (
          <OnboardingWelcome lang={lang} />
        )}
      </div>
    </div>
  );
}
