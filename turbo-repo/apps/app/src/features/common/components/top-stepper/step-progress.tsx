"use client";

import { twMerge } from "tailwind-merge";

type StepProgressProps = Readonly<{
  currentStepIndex: number;
  totalSteps: number;
  className?: string;
  /** Pill-shaped bar (default) vs. square edges, e.g. used flush as a separator. */
  rounded?: boolean;
}>;

/**
 * A thin bar that fills as the steps go by. Taken from the sign-up flow's
 * `RegisterProgress` (branch 896-redefine-login); the fill slides with CSS.
 */
export default function StepProgress({
  currentStepIndex,
  totalSteps,
  className,
  rounded = true,
}: StepProgressProps) {
  const percent = ((currentStepIndex + 1) / totalSteps) * 100;
  const roundedClass = rounded ? "rounded-full" : "rounded-none";
  return (
    <div
      className={twMerge(
        "relative h-0.5 w-full overflow-hidden bg-gray-100 dark:bg-gray-800",
        roundedClass,
        className
      )}
    >
      {/* The native element carries the progress; the bar below draws it. */}
      <progress
        className="sr-only"
        value={currentStepIndex + 1}
        max={totalSteps}
      />
      <div
        aria-hidden
        style={{ width: `${percent}%` }}
        className={twMerge(
          "h-full bg-blue-700 transition-[width] duration-300 ease-in-out",
          roundedClass
        )}
      />
    </div>
  );
}
