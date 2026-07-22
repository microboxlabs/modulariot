"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ONBOARDING_HANDOFF_KEY } from "./onboarding-handoff";

const DISSOLVE_DURATION_S = 0.9;

// Blurred white "front view" that dissolves away on mount, revealing the
// page underneath — but only when arriving straight from onboarding
// (signaled via sessionStorage), never on a regular visit to this page.
export default function OnboardingArrivalOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const cameFromOnboarding = sessionStorage.getItem(ONBOARDING_HANDOFF_KEY);
    if (!cameFromOnboarding) return;
    sessionStorage.removeItem(ONBOARDING_HANDOFF_KEY);
    setVisible(true);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-9999 bg-white dark:bg-gray-900 pointer-events-none"
          initial={{ opacity: 1, filter: "blur(8px)" }}
          animate={{ opacity: 0, filter: "blur(24px)" }}
          transition={{ duration: DISSOLVE_DURATION_S, ease: "easeInOut" }}
          onAnimationComplete={() => setVisible(false)}
        />
      )}
    </AnimatePresence>
  );
}
