"use client";

import { AnimatePresence, motion } from "motion/react";
import { RxCheck } from "react-icons/rx";
import { twMerge } from "tailwind-merge";

export type RegisterTopStepperItem = Readonly<{ title: string }>;

type RegisterTopStepperProps = Readonly<{
  steps: readonly RegisterTopStepperItem[];
  currentStepIndex: number;
}>;

const ACTIVE_COLOR = "#1d4ed8"; // blue-700, matches this form's link/button accent
const INACTIVE_COLOR = "#9ca3af"; // gray-400

/** Horizontal stepper: number/tick + title per step, separated by a line. */
export default function RegisterTopStepper({
  steps,
  currentStepIndex,
}: RegisterTopStepperProps) {
  return (
    <ol className="mb-6 flex w-full items-center">
      {steps.map((step, index) => {
        const isCompleted = index < currentStepIndex;
        const isCurrent = index === currentStepIndex;
        const isReached = isCompleted || isCurrent;
        const isLast = index === steps.length - 1;

        return (
          <li
            key={step.title}
            className={twMerge("flex items-center", !isLast && "flex-1")}
          >
            <div className="flex shrink-0 items-center gap-2">
              <motion.span
                animate={{
                  borderColor: isReached ? ACTIVE_COLOR : INACTIVE_COLOR,
                  backgroundColor: isReached
                    ? ACTIVE_COLOR
                    : "rgba(0, 0, 0, 0)",
                  color: isReached ? "#ffffff" : INACTIVE_COLOR,
                }}
                transition={{ duration: 0.25 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isCompleted ? (
                    <motion.span
                      key="check"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.15 }}
                      className="flex items-center justify-center"
                    >
                      <RxCheck className="h-4 w-4" />
                    </motion.span>
                  ) : (
                    <motion.span
                      key="number"
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ duration: 0.15 }}
                    >
                      {index + 1}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.span>
              <span
                className={twMerge(
                  "whitespace-nowrap text-sm font-medium transition-colors duration-300",
                  isReached
                    ? "text-gray-900 dark:text-white"
                    : "text-gray-400 dark:text-gray-500"
                )}
              >
                {step.title}
              </span>
            </div>

            {!isLast && (
              <div className="mx-3 h-px flex-1 bg-gray-200 dark:bg-gray-700" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
