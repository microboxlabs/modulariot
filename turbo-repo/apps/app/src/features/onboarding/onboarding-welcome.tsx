"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import Image from "next/image";
import { Button } from "flowbite-react";
import { FaArrowRight } from "react-icons/fa";
// eslint-disable-next-line import/no-unresolved
import logoIcon from "@assets/logo-icon.svg";
import { ONBOARDING_STEPS } from "./onboarding-steps";
import BackgroundShapes from "./background-shapes";

const LEAVE_TRANSITION_S = 0.6;

export default function OnboardingWelcome({
  lang,
}: Readonly<{ lang: string }>) {
  const router = useRouter();
  const [isLeaving, setIsLeaving] = useState(false);

  const handleStart = () => {
    setIsLeaving(true);
    setTimeout(() => {
      router.push(`/${lang}/onboarding?step=${ONBOARDING_STEPS[0].id}`);
    }, LEAVE_TRANSITION_S * 1000);
  };

  return (
    <div
      className={`relative w-full h-full transition-colors duration-600 ease-in-out ${
        isLeaving ? "bg-white dark:bg-gray-900" : "bg-transparent"
      }`}
    >
      <motion.div
        animate={{ opacity: isLeaving ? 0 : 1 }}
        transition={{ duration: LEAVE_TRANSITION_S, ease: "easeInOut" }}
      >
        <BackgroundShapes />
      </motion.div>
      <motion.div
        className="relative z-10 flex flex-col items-center justify-center w-full h-full max-w-md mx-auto gap-10 px-6 text-center"
        animate={{
          opacity: isLeaving ? 0 : 1,
          filter: isLeaving ? "blur(16px)" : "blur(0px)",
        }}
        transition={{ duration: LEAVE_TRANSITION_S, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center justify-center w-20 h-20 rounded-2xl bg-white dark:bg-gray-800 shadow-sm ring-1 ring-gray-100 dark:ring-gray-700 p-3">
            <Image
              src={logoIcon}
              alt="ModularIOT"
              width={56}
              height={48}
              priority
            />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            Set up your control tower
          </h1>
        </div>
        <div className="flex flex-col items-center gap-6 w-full">
          <p className="max-w-sm text-base leading-relaxed text-gray-500 dark:text-gray-400">
            ModularIoT watches your fleet for problems — the way a hospital
            monitors patients. Pick the vital signs we should watch for. You
            can change any of this later.
          </p>
          <Button
            type="button"
            onClick={handleStart}
            color="blue"
            size="lg"
            className="w-full"
          >
            <span className="flex items-center justify-center gap-2">
              Start setup
              <FaArrowRight className="w-4 h-4" />
            </span>
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
