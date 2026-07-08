"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import OnboardingHeader from "./onboarding-header";
import OnboardingFooter from "./onboarding-footer";
import { OnboardingStepId } from "./onboarding-steps";
import ProfileStep from "./steps/profile-step";
import VitalSignsStep from "./steps/vital-signs-step";
import PreparingExperience from "./preparing-experience";
import { ONBOARDING_HANDOFF_KEY } from "./onboarding-handoff";

export default function OnboardingStepper({
  lang,
  currentStep,
  profileId,
}: Readonly<{
  lang: string;
  currentStep: OnboardingStepId;
  profileId: string;
}>) {
  const router = useRouter();
  const [isFinishing, setIsFinishing] = useState(false);

  return (
    <AnimatePresence mode="wait">
      {isFinishing ? (
        <motion.div
          key="finishing"
          initial={{ opacity: 0, filter: "blur(16px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="w-full h-full bg-gray-100 dark:bg-gray-800"
        >
          <PreparingExperience
            onComplete={() => {
              sessionStorage.setItem(ONBOARDING_HANDOFF_KEY, "1");
              router.push(`/${lang}/home`);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="form"
          initial={{ opacity: 0, filter: "blur(16px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(16px)" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="flex flex-col w-full h-full bg-gray-100 dark:bg-gray-800"
        >
          <OnboardingHeader
            lang={lang}
            currentStep={currentStep}
            profileId={profileId}
          />
          <div
            key={currentStep}
            className="flex-1 overflow-y-auto p-6 animate-fade-in-opacity"
          >
            {currentStep === "profile" && (
              <ProfileStep selectedProfileId={profileId} />
            )}
            {currentStep === "vital-signs" && (
              <VitalSignsStep profileId={profileId} />
            )}
          </div>
          <OnboardingFooter
            lang={lang}
            currentStep={currentStep}
            profileId={profileId}
            onFinish={() => setIsFinishing(true)}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
