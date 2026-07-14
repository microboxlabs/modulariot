"use client";

import { motion } from "motion/react";
import { twMerge } from "tailwind-merge";

type RegisterProgressProps = Readonly<{
  currentStepIndex: number;
  totalSteps: number;
  className?: string;
  /** Pill-shaped bar (default) vs. square edges, e.g. when used flush as a separator */
  rounded?: boolean;
}>;

export default function RegisterProgress({
  currentStepIndex,
  totalSteps,
  className,
  rounded = true,
}: RegisterProgressProps) {
  const percent = ((currentStepIndex + 1) / totalSteps) * 100;
  const roundedClass = rounded ? "rounded-full" : "rounded-none";

  return (
    <div
      className={twMerge(
        "h-0.5 w-full overflow-hidden bg-gray-100 dark:bg-gray-800",
        roundedClass,
        className
      )}
    >
      <motion.div
        animate={{ width: `${percent}%` }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className={twMerge("h-full bg-blue-700", roundedClass)}
      />
    </div>
  );
}
