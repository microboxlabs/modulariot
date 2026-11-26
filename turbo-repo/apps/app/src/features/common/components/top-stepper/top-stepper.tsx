"use client";

/**
 * Horizontal stepper: a number (a tick once done) and a title per step,
 * joined by a line. Taken from the sign-up flow's `RegisterTopStepper`
 * (branch 896-redefine-login) so both flows look alike; colour changes
 * fade with plain CSS here, as this app does not ship `motion`.
 *
 * Steps ahead of the current one are always grey, even ones already
 * visited. With `onSelect`, every step reached so far can be clicked, ahead
 * or behind; the ones not reached yet stay disabled.
 */
import { RxCheck } from "react-icons/rx";
import { twMerge } from "tailwind-merge";

export type TopStepperItem = Readonly<{ title: string }>;

type TopStepperProps = Readonly<{
  steps: readonly TopStepperItem[];
  currentStepIndex: number;
  /**
   * The furthest step reached so far; defaults to the current one. Steps
   * before it are done, even when the person went back to an earlier one.
   */
  reachedStepIndex?: number;
  onSelect?: (index: number) => void;
  disabled?: boolean;
  className?: string;
}>;

export default function TopStepper({
  steps,
  currentStepIndex,
  reachedStepIndex = currentStepIndex,
  onSelect,
  disabled = false,
  className,
}: TopStepperProps) {
  const furthest = Math.max(reachedStepIndex, currentStepIndex);
  return (
    <ol className={twMerge("mb-6 flex w-full items-center", className)}>
      {steps.map((step, index) => {
        const isCurrent = index === currentStepIndex;
        const isCompleted = index < currentStepIndex;
        const isReached = index <= furthest;
        // Coloured up to the current step only: what lies ahead stays grey.
        const isLit = index <= currentStepIndex;
        const isLast = index === steps.length - 1;
        const marker = (
          <>
            <span
              className={twMerge(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors duration-300",
                isLit
                  ? "border-blue-700 bg-blue-700 text-white"
                  : "border-gray-400 bg-transparent text-gray-400"
              )}
            >
              {isCompleted ? (
                <RxCheck aria-hidden className="h-4 w-4" />
              ) : (
                index + 1
              )}
            </span>
            <span
              className={twMerge(
                "min-w-0 text-center text-xs font-medium transition-colors duration-300 sm:whitespace-nowrap sm:text-left sm:text-sm",
                isLit
                  ? "text-gray-900 dark:text-white"
                  : "text-gray-400 dark:text-gray-500"
              )}
            >
              {step.title}
            </span>
          </>
        );

        return (
          <li
            key={step.title}
            className={twMerge(
              "flex min-w-0 flex-1 items-center",
              isLast && "sm:flex-none"
            )}
          >
            {onSelect ? (
              <button
                type="button"
                disabled={disabled || !isReached}
                aria-current={isCurrent ? "step" : undefined}
                onClick={() => onSelect(index)}
                className="flex w-full min-w-0 flex-col items-center gap-1 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed sm:w-auto sm:shrink-0 sm:flex-row sm:gap-2"
              >
                {marker}
              </button>
            ) : (
              <div
                aria-current={isCurrent ? "step" : undefined}
                className="flex w-full min-w-0 flex-col items-center gap-1 sm:w-auto sm:shrink-0 sm:flex-row sm:gap-2"
              >
                {marker}
              </div>
            )}

            {!isLast && (
              <div
                aria-hidden
                className="mx-3 hidden h-px flex-1 bg-gray-200 sm:block dark:bg-gray-700"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
