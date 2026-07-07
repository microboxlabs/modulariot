"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, type Variants } from "motion/react";
import BackgroundShapes from "./background-shapes";

const MESSAGES = [
  "Preparing your experience",
  "Doing some final configurations",
  "Now welcome",
  "to ModularIOT",
];

const MESSAGE_DURATION_MS = 3500;
const LAST_MESSAGE_HOLD_MS = 2000;
const WHITE_OUT_DURATION_MS = 900;

// Smooth ease-out — deliberate and calm rather than a bouncy spring.
const REFINED_EASE = [0.22, 1, 0.36, 1] as const;

const containerVariants: Variants = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.08 },
  },
  exit: {
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
};

const wordVariants: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.97 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.6, ease: REFINED_EASE },
  },
  exit: {
    opacity: 0,
    y: -14,
    scale: 0.98,
    transition: { duration: 0.35, ease: "easeIn" },
  },
};

export default function PreparingExperience({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [isWhitingOut, setIsWhitingOut] = useState(false);
  const isLastMessage = index === MESSAGES.length - 1;

  useEffect(() => {
    if (!isLastMessage) {
      const timer = setTimeout(
        () => setIndex((i) => i + 1),
        MESSAGE_DURATION_MS
      );
      return () => clearTimeout(timer);
    }
    const holdTimer = setTimeout(
      () => setIsWhitingOut(true),
      LAST_MESSAGE_HOLD_MS
    );
    return () => clearTimeout(holdTimer);
  }, [index, isLastMessage]);

  useEffect(() => {
    if (!isWhitingOut) return;
    const completeTimer = setTimeout(onComplete, WHITE_OUT_DURATION_MS);
    return () => clearTimeout(completeTimer);
  }, [isWhitingOut, onComplete]);

  return (
    <motion.div
      className="relative flex items-center justify-center w-full h-full overflow-hidden px-6"
      animate={{ backgroundColor: isWhitingOut ? "#ffffff" : "rgba(255,255,255,0)" }}
      transition={{ duration: WHITE_OUT_DURATION_MS / 1000, ease: "easeInOut" }}
    >
      <motion.div
        animate={{ opacity: isWhitingOut ? 0 : 1 }}
        transition={{ duration: WHITE_OUT_DURATION_MS / 1000, ease: "easeInOut" }}
      >
        <BackgroundShapes />
      </motion.div>
      <AnimatePresence mode="wait">
        {!isWhitingOut && (
          <motion.h1
            key={index}
            variants={containerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="relative z-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-3xl sm:text-4xl font-bold text-gray-700 dark:text-white text-center"
          >
            {MESSAGES[index].split(" ").map((word, wordIndex) => {
              const isBrand = word === "ModularIOT";
              return (
                <motion.span
                  key={wordIndex}
                  variants={wordVariants}
                  className={`inline-block ${
                    isBrand
                      ? "text-4xl sm:text-5xl text-blue-600 dark:text-blue-400"
                      : ""
                  }`}
                >
                  {word}
                </motion.span>
              );
            })}
          </motion.h1>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
