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
        className="absolute inset-0 hidden opacity-40 dark:block"
        style={{
          backgroundImage:
            "linear-gradient(120deg, #111827, #16213b, #1c2b4d, #111827)",
          backgroundSize: "300% 300%",
        }}
        animate={{ backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"] }}
        transition={GRADIENT_TRANSITION}
      />
    </div>
  );
}
