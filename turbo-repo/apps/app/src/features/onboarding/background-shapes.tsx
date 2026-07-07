"use client";

import { motion, type Transition } from "motion/react";

const GRADIENT_TRANSITION: Transition = {
  duration: 12,
  repeat: Infinity,
  repeatType: "mirror",
  ease: "easeInOut",
};

export default function BackgroundShapes() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div
        className="absolute inset-0 opacity-60 dark:hidden"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #ffffff, #eff6ff, #dbeafe, #ffffff)",
          backgroundSize: "300% 300%",
        }}
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={GRADIENT_TRANSITION}
      />
      <motion.div
        className="absolute inset-0 hidden opacity-60 dark:block"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #1e3a8a, #2563eb, #3b82f6, #1e3a8a)",
          backgroundSize: "300% 300%",
        }}
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={GRADIENT_TRANSITION}
      />
    </div>
  );
}
